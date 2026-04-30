import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthState } from '../../../domain/auth/auth-state';
import { navigatorKeys } from '../../../infra/kv/store';
import { createCallerFactory } from '../../init';
import { telemetryRouter } from '../telemetry-router';
import { MockKvStore, mockTelemetryContext } from './mocks';

const createCaller = createCallerFactory(telemetryRouter);

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

function generateNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    'base64url',
  );
}

async function signNonce(nonce: string): Promise<string> {
  const sigBytes = await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    Buffer.from(nonce, 'base64url'),
  );
  return Buffer.from(sigBytes).toString('base64url');
}

interface ChallengeOverrides {
  expiresAt?: number;
  used?: boolean;
  publicKey?: CryptoKey;
}

function kvWithChallenge(
  nonce: string,
  overrides: ChallengeOverrides = {},
): MockKvStore {
  const challenge = {
    nonce,
    publicKey: overrides.publicKey ?? publicKey,
    expiresAt: overrides.expiresAt ?? Date.now() + 30_000,
    used: overrides.used ?? false,
  };
  return new MockKvStore({
    get: vi
      .fn()
      .mockImplementation(key =>
        Promise.resolve(
          key === navigatorKeys.challenge(nonce) ? challenge : undefined,
        ),
      ),
  });
}

describe('telemetry verifyChallenge', () => {
  it.each([
    {
      name: 'unknown challenge (no entry in KV)',
      buildCtx: () => ({
        ctx: mockTelemetryContext(),
        nonce: generateNonce(),
      }),
      buildSignature: signNonce,
      expectedMessage: 'unknown challenge',
    },
    {
      name: 'challenge has expired',
      buildCtx: () => {
        const nonce = generateNonce();
        return {
          ctx: mockTelemetryContext({
            services: {
              kv: kvWithChallenge(nonce, { expiresAt: Date.now() - 1 }),
            },
          }),
          nonce,
        };
      },
      buildSignature: signNonce,
      expectedMessage: 'challenge expired',
    },
    {
      name: 'challenge has already been used',
      buildCtx: () => {
        const nonce = generateNonce();
        return {
          ctx: mockTelemetryContext({
            services: { kv: kvWithChallenge(nonce, { used: true }) },
          }),
          nonce,
        };
      },
      buildSignature: signNonce,
      expectedMessage: 'challenge used',
    },
    {
      name: 'signature was made with a different private key',
      buildCtx: () => {
        const nonce = generateNonce();
        return {
          ctx: mockTelemetryContext({
            services: { kv: kvWithChallenge(nonce) },
          }),
          nonce,
        };
      },
      buildSignature: async (nonce: string) => {
        const otherPair = (await crypto.subtle.generateKey('Ed25519', true, [
          'sign',
          'verify',
        ])) as CryptoKeyPair;
        const sigBytes = await crypto.subtle.sign(
          'Ed25519',
          otherPair.privateKey,
          Buffer.from(nonce, 'base64url'),
        );
        return Buffer.from(sigBytes).toString('base64url');
      },
      expectedMessage: 'invalid signature',
    },
  ])(
    'rejects UNAUTHORIZED when $name',
    async ({ buildCtx, buildSignature, expectedMessage }) => {
      const { ctx, nonce } = buildCtx();
      const signature = await buildSignature(nonce);
      const caller = createCaller(ctx);

      await expect(
        caller.verifyChallenge({ challenge: nonce, signature }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: expectedMessage,
      });
    },
  );

  it('marks challenge as used and transitions auth on success', async () => {
    const nonce = generateNonce();
    const kv = kvWithChallenge(nonce);
    const ctx = mockTelemetryContext({ services: { kv } });
    const signature = await signNonce(nonce);

    await createCaller(ctx).verifyChallenge({ challenge: nonce, signature });

    expect(kv.set).toHaveBeenCalledWith(
      navigatorKeys.challenge(nonce),
      expect.objectContaining({ used: true }),
    );
    expect(ctx.auth.state).toBe(AuthState.DEVICE_PROVISIONAL_WITHOUT_CODE);
    if (ctx.auth.state === AuthState.DEVICE_PROVISIONAL_WITHOUT_CODE) {
      expect(ctx.auth.publicKey).toBe(publicKey);
    }
  });
});
