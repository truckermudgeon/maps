import type { KvStore } from '../../infra/kv/store';
import { navigatorKeys } from '../../infra/kv/store';

export enum ReconnectRejectionReason {
  UNKNOWN_KEY,
  INVALID_TIMESTAMP,
  INVALID_SIGNATURE,
}

export type ReconnectVerification =
  | { ok: true; publicKey: CryptoKey }
  | { ok: false; reason: ReconnectRejectionReason };

const TIMESTAMP_WINDOW_MS = 300_000;

export async function verifyReconnectSignature(
  args: { telemetryId: string; timestamp: number; signature: string },
  kv: Pick<KvStore, 'get'>,
): Promise<ReconnectVerification> {
  const { telemetryId, timestamp, signature } = args;

  const publicKey = await kv.get(navigatorKeys.publicKey(telemetryId));
  if (!publicKey) {
    return { ok: false, reason: ReconnectRejectionReason.UNKNOWN_KEY };
  }

  const now = Date.now();
  const isTimestampValid =
    now - TIMESTAMP_WINDOW_MS < timestamp &&
    timestamp <= now + TIMESTAMP_WINDOW_MS;
  if (!isTimestampValid) {
    return { ok: false, reason: ReconnectRejectionReason.INVALID_TIMESTAMP };
  }

  const isSignatureValid = await crypto.subtle.verify(
    'Ed25519',
    publicKey,
    Buffer.from(signature, 'base64url'),
    Buffer.from(JSON.stringify({ telemetryId, timestamp }), 'utf8'),
  );
  if (!isSignatureValid) {
    return { ok: false, reason: ReconnectRejectionReason.INVALID_SIGNATURE };
  }

  return { ok: true, publicKey };
}
