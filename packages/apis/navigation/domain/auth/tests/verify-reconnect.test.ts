import { beforeAll, describe, expect, it, vi } from 'vitest';
import { navigatorKeys } from '../../../infra/kv/store';
import { MockKvStore } from '../../../trpc/routers/tests/mocks';
import {
  ReconnectRejectionReason,
  verifyReconnectSignature,
} from '../verify-reconnect';

const TELEMETRY_ID = '00000000-0000-0000-0000-000000000001';

let publicKey: CryptoKey;
let privateKey: CryptoKey;

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey('Ed25519', true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  publicKey = pair.publicKey;
  privateKey = pair.privateKey;
});

async function sign(telemetryId: string, timestamp: number): Promise<string> {
  const payload = Buffer.from(
    JSON.stringify({ telemetryId, timestamp }),
    'utf8',
  );
  const sigBytes = await crypto.subtle.sign('Ed25519', privateKey, payload);
  return Buffer.from(sigBytes).toString('base64url');
}

function kvWithPublicKey(): MockKvStore {
  return new MockKvStore({
    get: vi
      .fn()
      .mockImplementation(key =>
        Promise.resolve(
          key === navigatorKeys.publicKey(TELEMETRY_ID) ? publicKey : undefined,
        ),
      ),
  });
}

describe('verifyReconnectSignature', () => {
  it('returns ok with public key when signature, timestamp, and key are all valid', async () => {
    const timestamp = Date.now();
    const signature = await sign(TELEMETRY_ID, timestamp);

    const result = await verifyReconnectSignature(
      { telemetryId: TELEMETRY_ID, timestamp, signature },
      kvWithPublicKey(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.publicKey).toBe(publicKey);
    }
  });

  it.each([
    {
      name: 'unknown key (no entry in KV)',
      buildArgs: async () => {
        const timestamp = Date.now();
        return {
          args: {
            telemetryId: TELEMETRY_ID,
            timestamp,
            signature: await sign(TELEMETRY_ID, timestamp),
          },
          kv: new MockKvStore(), // get() defaults to undefined
        };
      },
      expectedReason: ReconnectRejectionReason.UNKNOWN_KEY,
    },
    {
      name: 'timestamp too old (>5 min in past)',
      buildArgs: async () => {
        const timestamp = Date.now() - 6 * 60_000;
        return {
          args: {
            telemetryId: TELEMETRY_ID,
            timestamp,
            signature: await sign(TELEMETRY_ID, timestamp),
          },
          kv: kvWithPublicKey(),
        };
      },
      expectedReason: ReconnectRejectionReason.INVALID_TIMESTAMP,
    },
    {
      name: 'timestamp too new (>5 min in future)',
      buildArgs: async () => {
        const timestamp = Date.now() + 6 * 60_000;
        return {
          args: {
            telemetryId: TELEMETRY_ID,
            timestamp,
            signature: await sign(TELEMETRY_ID, timestamp),
          },
          kv: kvWithPublicKey(),
        };
      },
      expectedReason: ReconnectRejectionReason.INVALID_TIMESTAMP,
    },
    {
      name: 'signature signed by a different private key',
      buildArgs: async () => {
        const otherPair = (await crypto.subtle.generateKey('Ed25519', true, [
          'sign',
          'verify',
        ])) as CryptoKeyPair;
        const timestamp = Date.now();
        const sigBytes = await crypto.subtle.sign(
          'Ed25519',
          otherPair.privateKey,
          Buffer.from(
            JSON.stringify({ telemetryId: TELEMETRY_ID, timestamp }),
            'utf8',
          ),
        );
        return {
          args: {
            telemetryId: TELEMETRY_ID,
            timestamp,
            signature: Buffer.from(sigBytes).toString('base64url'),
          },
          kv: kvWithPublicKey(),
        };
      },
      expectedReason: ReconnectRejectionReason.INVALID_SIGNATURE,
    },
    {
      name: 'signature was made for a different timestamp',
      buildArgs: async () => {
        const timestamp = Date.now();
        return {
          args: {
            telemetryId: TELEMETRY_ID,
            timestamp,
            signature: await sign(TELEMETRY_ID, timestamp + 1),
          },
          kv: kvWithPublicKey(),
        };
      },
      expectedReason: ReconnectRejectionReason.INVALID_SIGNATURE,
    },
  ])(
    'rejects when $name with reason=$expectedReason',
    async ({ buildArgs, expectedReason }) => {
      const { args, kv } = await buildArgs();

      const result = await verifyReconnectSignature(args, kv);

      expect(result).toEqual({ ok: false, reason: expectedReason });
    },
  );
});
