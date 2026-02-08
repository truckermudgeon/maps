import type { TelemetryClient } from './create-telemetry-client';
import {
  createReconnectRequest,
  getPublicKey,
  signChallenge,
  storeTelemetryId,
} from './telemetry-id';
import { waitForPairing } from './wait-for-pairing';

export async function connectToServer(options: {
  telemetryClient: TelemetryClient;
  telemetryId: string | undefined;
  onPairingCodeReceived: (code: string) => void;
}) {
  const { telemetryClient, telemetryId, onPairingCodeReceived } = options;

  if (!telemetryId) {
    await doPairingFlow(telemetryClient, onPairingCodeReceived);
  } else {
    console.log('reconnecting with telemetry id', telemetryId);
    const req = await createReconnectRequest();
    const ok = await telemetryClient.reconnect.mutate(req);
    if (!ok) {
      console.log('reconnect failed.');
      await doPairingFlow(telemetryClient, onPairingCodeReceived);
    }
  }
}

async function requestPairingCode(
  telemetryClient: TelemetryClient,
): Promise<string> {
  console.log('requesting pairing code from server');
  const publicKey = await getPublicKey();
  const challenge = await telemetryClient.issueChallenge.mutate({
    publicKey,
  });
  const signature = await signChallenge(challenge);
  await telemetryClient.verifyChallenge.mutate({
    challenge,
    signature,
  });

  return telemetryClient.requestPairingCode.mutate();
}

async function doPairingFlow(
  telemetryClient: TelemetryClient,
  onPairingCodeReceived: (code: string) => void,
) {
  const pairingCode = await requestPairingCode(telemetryClient);
  onPairingCodeReceived(pairingCode);

  const { telemetryId } = await waitForPairing(telemetryClient);
  storeTelemetryId(telemetryId);
}
