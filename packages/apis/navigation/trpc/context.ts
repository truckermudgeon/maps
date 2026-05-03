import { TRPCError } from '@trpc/server';
import type { TRPCRequestInfo } from '@trpc/server/http';
import { Preconditions } from '@truckermudgeon/base/precon';
import type crypto from 'crypto';
import type http from 'http';
import type { WebSocket } from 'ws';
import { AuthState } from '../domain/auth/auth-state';
import { verifyReconnectSignature } from '../domain/auth/verify-reconnect';
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
    case '/telemetry?connectionParams=1': {
      const unauthenticatedContext: TelemetryContext = {
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

      if (
        info.connectionParams?.telemetryId == null ||
        info.connectionParams.signature == null ||
        info.connectionParams.timestamp == null
      ) {
        return unauthenticatedContext;
      }

      const {
        telemetryId,
        signature,
        timestamp: _timestamp,
      } = info.connectionParams;
      const timestamp = Number(_timestamp);
      const result = await verifyReconnectSignature(
        { telemetryId, timestamp, signature },
        services.kv,
      );
      if (!result.ok) {
        logger.warn(`(reconnect): ${result.reason}`, {
          clientId,
          telemetryId,
        });
        return unauthenticatedContext;
      }

      logger.info('successful reconnect (telemetry)', {
        clientId,
        telemetryId,
      });

      return {
        ...unauthenticatedContext,
        auth: {
          state: AuthState.DEVICE_AUTHENTICATED,
          deviceId: telemetryId,
        },
      };
    }
    case '/navigator':
    case '/navigator?connectionParams=1': {
      const unauthenticatedContext: NavigatorContext = {
        type: 'navigator',
        clientId,
        auth: { state: AuthState.UNAUTHENTICATED },
        services,
        wsConnectionState,
      };

      if (info.connectionParams?.viewerId == null) {
        return unauthenticatedContext;
      }

      // TODO de-dupe some of this code and `navigatorRouter.reconnect`
      const viewerId = info.connectionParams.viewerId;
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

        logger.info('successful reconnect (navigator)', {
          clientId,
          viewerId,
          telemetryId,
        });

        return {
          ...unauthenticatedContext,
          auth: { state: AuthState.VIEWER_AUTHENTICATED, viewerId },
        };
      } else {
        logger.warn('(reconnect): no telemetry id associated with viewer id', {
          clientId,
          viewerId,
          telemetryId,
        });
        return unauthenticatedContext;
      }
    }
    default:
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'unexpected URL',
      });
  }
}
