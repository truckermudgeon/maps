import type { TRPCClient } from '@trpc/client';
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';
import type { AppRouter } from '@truckermudgeon/navigation/types';
import { NODE_ENV } from './constants';
import { createReconnectRequest } from './telemetry-id';

export type TelemetryClient = TRPCClient<AppRouter>['telemetry'];

export function createTelemetryClient(options: {
  apiUrl: string;
  onError: (maybeEvent: Event | undefined) => void;
  onClose: (cause: { code?: number } | undefined) => void;
  onOpen?: () => void;
}): { telemetryClient: TelemetryClient; debugClose: () => void } {
  // don't attempt reconnect on the initial connection. assume consumers
  // will call `connectToServer` to establish initial connection (and handle
  // reconnect logic, if necessary).
  let attemptReconnect = false;
  const wsClient = createWSClient({
    url: options.apiUrl,
    connectionParams: async () => {
      if (!attemptReconnect) {
        attemptReconnect = true;
        return null;
      }

      const req = await createReconnectRequest();
      return req
        ? {
            ...req,
            timestamp: req.timestamp.toString(),
          }
        : null;
    },
    onError: options.onError,
    onClose: options.onClose,
    onOpen: options?.onOpen,
    keepAlive: {
      enabled: true,
      intervalMs: 30_000,
      pongTimeoutMs: 5_000,
    },
  });

  const debugClose =
    NODE_ENV === 'development'
      ? () =>
          // HACK access private `activeConnection` field, so we can
          // ungracefully close the underlying websocket in order to test
          // reconnect logic in the client and the server.
          (
            wsClient as unknown as { activeConnection: { close: () => void } }
          ).activeConnection.close()
      : () => void 0;

  const client = createTRPCProxyClient<AppRouter>({
    links: [
      wsLink({
        client: wsClient,
      }),
    ],
  }).telemetry;

  return { telemetryClient: client, debugClose };
}
