import type { TRPCClient } from '@trpc/client';

import type { AppRouter } from '@truckermudgeon/navigation/types';

export async function waitForPairing(
  telemetryClient: TRPCClient<AppRouter>['telemetry'],
): Promise<{ telemetryId: string }> {
  return new Promise((resolve, reject) => {
    const waitTimeoutId = setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error('did not receive pairing signal within 10 minutes.'));
    }, 10 * 60_000);

    const subscription = telemetryClient.waitForPairing.subscribe(void 0, {
      onStarted: () => {
        console.log(new Date(), 'waiting 10 minutes for pairing signal...');
      },
      onData: res => {
        clearTimeout(waitTimeoutId);
        console.log('pairing signal received.');
        resolve(res);
      },
      onError: err => {
        subscription.unsubscribe();
        reject(err);
      },
    });
  });
}
