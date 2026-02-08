import type { TRPCClient } from '@trpc/client';
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';
import type { AppRouter } from '@truckermudgeon/navigation/types';

export type TelemetryClient = TRPCClient<AppRouter>['telemetry'];

export function createTelemetryClient(options: {
  apiUrl: string;
  onError: (maybeEvent: Event | undefined) => void;
  onClose: (cause: { code?: number } | undefined) => void;
}): TelemetryClient {
  return createTRPCProxyClient<AppRouter>({
    links: [
      wsLink({
        client: createWSClient({
          url: options.apiUrl,
          onError: options.onError,
          onClose: options.onClose,
          keepAlive: {
            enabled: true,
            intervalMs: 30_000,
            pongTimeoutMs: 5_000,
          },
        }),
      }),
    ],
  }).telemetry;
}
