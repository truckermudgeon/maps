import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';
import { Preconditions } from '@truckermudgeon/base/precon';
import type { AppRouter as TelemetryAppRouter } from '@truckermudgeon/telemetry';
import type { TruckSimTelemetry } from '@truckermudgeon/telemetry/types';
import { EventEmitter } from 'events';

let listeningToTelemetry = false;

export type TelemetryEventEmitter = EventEmitter<{
  telemetry: [TruckSimTelemetry];
}>;

export function listenToTelemetry(
  port = 3001,
  host = 'localhost',
): {
  readTelemetry: () => TruckSimTelemetry | undefined;
  telemetryEventEmitter: TelemetryEventEmitter;
} {
  Preconditions.checkState(!listeningToTelemetry);
  listeningToTelemetry = true;

  let telemetry: TruckSimTelemetry | undefined;
  const telemetryEventEmitter: TelemetryEventEmitter = new EventEmitter();
  const telemetryClient = createTRPCProxyClient<TelemetryAppRouter>({
    links: [
      wsLink({
        client: createWSClient({
          url: `ws://${host}:${port}`,
        }),
      }),
    ],
  });
  telemetryClient.onTelemetry.subscribe(undefined, {
    onData: newTelemetry => {
      telemetry = newTelemetry;
      telemetryEventEmitter.emit('telemetry', newTelemetry);
    },
  });
  return {
    readTelemetry: () => telemetry,
    telemetryEventEmitter,
  };
}
