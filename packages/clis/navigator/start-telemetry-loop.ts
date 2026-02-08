import type { TRPCClient } from '@trpc/client';
import type { AppRouter } from '@truckermudgeon/navigation/types';
import type { TelemetryReader } from './get-telemetry';
import { strip } from './strip-telemetry';

type PushState = 'neverPushed' | 'waitingForTelemetry' | 'pushed';

export function startTelemetryLoop(options: {
  getTelemetry: TelemetryReader;
  telemetryClient: TRPCClient<AppRouter>['telemetry'];
  onError: (err: unknown) => void;
}) {
  const { getTelemetry, telemetryClient, onError } = options;

  let telemetryPushState: PushState = 'neverPushed';
  let lastPushed: number;
  const deltas: number[] = [];
  const updatePushState = (newState: PushState) => {
    if (newState !== telemetryPushState) {
      console.log(new Date(), 'telemetry state:', newState);
      telemetryPushState = newState;
    }
  };

  const pushTelemetry = () => {
    const telemetry = getTelemetry();
    if (
      !telemetry ||
      (telemetry.truck.position.X === 0 &&
        telemetry.truck.position.Y === 0 &&
        telemetry.truck.position.Z === 0)
    ) {
      // game isn't running yet, or game is running but truck hasn't been placed
      updatePushState('waitingForTelemetry');
      setTimeout(pushTelemetry, 500);
      return;
    }

    if (deltas.length === 1000) {
      const average = deltas.reduce((acc, v) => acc + v, 0) / 1000;
      console.log('average delta (ms):', average);
      deltas.length = 0;
    }

    updatePushState('pushed');
    lastPushed = Date.now();
    telemetryClient.push
      .mutate({ data: strip(telemetry) })
      .then(() => {
        const delta = Date.now() - lastPushed;
        deltas.push(delta);
        setTimeout(pushTelemetry, clamp(500 - delta, 0, 500));
      })
      .catch(onError);
  };

  pushTelemetry();
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
