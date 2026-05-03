import type { KvStore } from '../../infra/kv/store';
import { navigatorKeys } from '../../infra/kv/store';

export enum ReconnectRejectionReason {
  UNKNOWN_KEY = 'UNKNOWN_KEY',
  INVALID_TIMESTAMP = 'INVALID_TIMESTAMP',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
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

  const signatureBytes = Buffer.from(signature, 'base64url');
  const payloadJson = JSON.stringify({ telemetryId, timestamp });

  if (
    await crypto.subtle.verify(
      'Ed25519',
      publicKey,
      signatureBytes,
      Buffer.from(payloadJson, 'utf8'),
    )
  ) {
    return { ok: true, publicKey };
  }

  // TODO(2026-05-30): remove this legacy fallback. Older clients signed the
  // payload as Buffer.from(json, 'base64url'), which silently decoded almost
  // none of the JSON (it contains non-base64url characters). Both signer and
  // verifier matched, so it 'worked', but the effective signed message was
  // nearly constant. New clients use 'utf8'; drop this branch once enough
  // time has passed for paired clients to upgrade.
  if (
    await crypto.subtle.verify(
      'Ed25519',
      publicKey,
      signatureBytes,
      Buffer.from(payloadJson, 'base64url'),
    )
  ) {
    return { ok: true, publicKey };
  }

  return { ok: false, reason: ReconnectRejectionReason.INVALID_SIGNATURE };
}
