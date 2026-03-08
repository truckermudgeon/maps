import { apiUrl, healthUrl } from '@truckermudgeon/navigator-client/constants';
import type { TelemetryClient } from '@truckermudgeon/navigator-client/helpers';
import {
  checkIsServerUp,
  connectToServer,
  createTelemetryClient,
  createTelemetryReader,
  getTelemetryId,
  startTelemetryLoop,
} from '@truckermudgeon/navigator-client/helpers';
import type { HealthCheckEvent, WebviewRPC } from './types';

export async function startTelemetryClient(rpc: WebviewRPC) {
  console.log('startTelemetryClient');
  const healthCheck: HealthCheckEvent = await checkIsServerUp(healthUrl);
  rpc.send('healthCheck', healthCheck);
  if (!healthCheck.ok) {
    return;
  }

  const clientPromise = new Promise<TelemetryClient>((resolve, reject) => {
    const telemetryClient = createTelemetryClient({
      apiUrl,
      onError: (maybeEvent: Event | undefined) => {
        console.error(maybeEvent);
        rpc.send('socket', { type: 'ERROR' });
        reject(new Error('error while trying to connect to server'));
      },
      onClose: (maybeCause: { code?: number } | undefined) => {
        if (maybeCause?.code === 1001) {
          console.log('the server shut down.');
        }
        rpc.send('socket', { type: 'CLOSE' });
      },
      onOpen: () => {
        console.log('socket open');
        rpc.send('socket', { type: 'OPEN' });
        resolve(telemetryClient);
      },
    });
  });

  let telemetryClient: TelemetryClient;
  try {
    telemetryClient = await clientPromise;
  } catch {
    return;
  }
  // socket is connected at this point.

  // server handshake
  const telemetryId = getTelemetryId();
  try {
    await connectToServer({
      telemetryClient,
      telemetryId,
      onPairingCodeReceived: pairingCode =>
        rpc.send('pairingCode', pairingCode),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    rpc.send('connectError', msg);
    return;
  }

  try {
    const pairingCode =
      await telemetryClient.requestAdditionalPairingCode.mutate();
    rpc.send('pairingCode', pairingCode);
    rpc.send('reconnected');
  } catch {
    // TODO update UI to reflect error? try again? something else?
  }

  const getTelemetry = createTelemetryReader({ mode: 'live' });
  startTelemetryLoop({
    getTelemetry,
    telemetryClient,
    onError: err => {
      let errMsg: string;
      if (err instanceof Error) {
        errMsg = err.message;
        console.log('error:', err.message);
      } else {
        errMsg = String(err);
        console.log(err ?? 'unknown error');
      }
      rpc.send('telemetryError', errMsg);
    },
    onTelemetry: type => {
      rpc.send('telemetry', type);
    },
    onDelta: deltaMs => {
      rpc.send('telemetryDeltaMs', deltaMs);
    },
  });
}
