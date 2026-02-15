import { TRPCError } from '@trpc/server';
import type { TRPCRequestInfo } from '@trpc/server/http';
import { Preconditions } from '@truckermudgeon/base/precon';
import type crypto from 'crypto';
import type http from 'http';
import type { WebSocket } from 'ws';
import { AuthState } from '../domain/auth/auth-state';
import type { SessionActor } from '../domain/session-actor';
import type { ReadonlySessionActorRegistry } from '../infra/actors/registry';
import { navigatorKeys } from '../infra/kv/store';
import { logger } from '../infra/logging/logger';
import type { Services } from '../infra/services';
import type { WsConnectionState, WSRegistry } from '../infra/ws/registry';

export type Context = TelemetryContext | NavigatorContext;

// TODO i should probably have separate servers:
//   - accepting + storing telemetry
//   - handling navigator requests
//  but this is fine for now.

export interface TelemetryContext {
  type: 'telemetry';
  clientId: string;
  wsConnectionState: WsConnectionState;
  auth:
    | {
        state: AuthState.UNAUTHENTICATED;
      }
    | {
        state: AuthState.DEVICE_PROVISIONAL_WITHOUT_CODE;
        publicKey: crypto.webcrypto.CryptoKey;
      }
    | {
        state: AuthState.DEVICE_PROVISIONAL_WITH_CODE;
        publicKey: crypto.webcrypto.CryptoKey;
        pairingCode: string;
      }
    | {
        state: AuthState.DEVICE_AUTHENTICATED;
        deviceId: string;
      };
  services: Pick<Services, 'kv' | 'metrics' | 'rateLimit'> & {
    sessionActors: ReadonlySessionActorRegistry;
  };
}

export interface NavigatorContext {
  type: 'navigator';
  clientId: string;
  wsConnectionState: WsConnectionState;
  auth:
    | {
        state: AuthState.UNAUTHENTICATED;
      }
    | {
        state: AuthState.VIEWER_AUTHENTICATED;
        viewerId: string;
      };
  services: Services;
  sessionActor?: SessionActor;
}

export async function createContext(opts: {
  info: TRPCRequestInfo;
  req: http.IncomingMessage;
  res: WebSocket;
  services: Services;
  wsRegistry: WSRegistry;
}): Promise<Context> {
  const { info, req, res, services, wsRegistry } = opts;
  const wsConnectionState = Preconditions.checkExists(wsRegistry.get(res));
  const clientId = wsConnectionState.websocketKey;

  switch (req.url) {
    case '/telemetry':
      return {
        type: 'telemetry',
        clientId,
        auth: { state: AuthState.UNAUTHENTICATED },
        services: {
          kv: services.kv,
          metrics: services.metrics,
          rateLimit: services.rateLimit,
          sessionActors: services.sessionActors,
        },
        wsConnectionState,
      };
    case '/navigator':
    case '/navigator?connectionParams=1': {
      // TODO de-dupe some of this code and `navigatorRouter.reconnect`
      if (
        info.connectionParams?.['viewerId'] != null &&
        typeof info.connectionParams['viewerId'] === 'string'
      ) {
        // try to reauthenticate.
        // note: failure will still require user to reload if they're in the
        // middle of a tRPC reconnect, because they'll be unauthenticated but
        // will try to restore subscriptions.
        const viewerId = info.connectionParams['viewerId'];
        const telemetryId = await services.kv.get(
          navigatorKeys.viewerId(viewerId),
        );
        if (telemetryId) {
          const actor = services.sessionActors.getOrCreate(telemetryId);
          if (!actor.attachClient(clientId)) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Too many clients connected to this code',
            });
          }

          logger.info('successful reconnect', {
            clientId,
            viewerId,
            telemetryId,
          });

          return {
            type: 'navigator',
            clientId,
            auth: { state: AuthState.VIEWER_AUTHENTICATED, viewerId },
            services,
            wsConnectionState,
          };
        } else {
          logger.warn(
            '(reconnect): no telemetry id associated with viewer id: ' +
              viewerId,
          );
        }
      }

      return {
        type: 'navigator',
        clientId,
        auth: { state: AuthState.UNAUTHENTICATED },
        services,
        wsConnectionState,
      };
    }
    default:
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'unexpected URL',
      });
  }
}
