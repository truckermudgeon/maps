import { TRPCError } from '@trpc/server';
import { assert, assertExists } from '@truckermudgeon/base/assert';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthState } from '../../domain/auth/auth-state';
import { transition } from '../../domain/auth/transition';
import { generatePairingCode } from '../../domain/pairing-code';
import { TruckSimTelemetrySchema } from '../../domain/schemas';
import { navigatorKeys } from '../../infra/kv/store';
import type { Context } from '../context';
import { publicProcedure, router } from '../init';
import { loggingMiddleware } from '../middleware/logging';
import { metricsMiddleware } from '../middleware/metrics';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { requireAuthState } from '../middleware/require-auth-state';
import { requireTelemetryContext } from '../middleware/require-telemetry-context';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// TODO actually limit to once per session
const limitOncePerSession = rateLimitMiddleware({
  maxCalls: 1,
  per: 'day',
});

const telemetryProcedure = publicProcedure
  .use(loggingMiddleware)
  .use(metricsMiddleware)
  .use(requireTelemetryContext);

/** Router for the desktop telemetry client */
export const telemetryRouter = router({
  issueChallenge: telemetryProcedure
    .use(requireAuthState([AuthState.UNAUTHENTICATED]))
    .use(limitOncePerSession)
    .input(
      z.object({
        publicKey: z.object({
          key_ops: z.optional(z.array(z.string().max(20)).length(1)),
          ext: z.optional(z.boolean()),
          crv: z.optional(z.string()),
          x: z.optional(z.string().max(100)),
          kty: z.optional(z.string().max(10)),
        }),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<string> => {
      const {
        services: { kv },
      } = ctx;
      const nonce = crypto.randomBytes(32).toString('base64url');
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        input.publicKey,
        'Ed25519',
        true,
        ['verify'],
      );
      await kv.set(navigatorKeys.challenge(nonce), {
        nonce,
        publicKey,
        expiresAt: Date.now() + 30_000,
        used: false,
      });
      return nonce;
    }),
  verifyChallenge: telemetryProcedure
    .use(requireAuthState([AuthState.UNAUTHENTICATED]))
    .use(limitOncePerSession)
    .input(
      z.object({
        challenge: z.string().max(200),
        signature: z.string().max(200),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<void> => {
      const {
        services: { kv },
      } = ctx;
      const challengeKey = navigatorKeys.challenge(input.challenge);
      const challenge = await kv.get(challengeKey);
      if (challenge == null) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'unknown challenge',
        });
      }

      if (Date.now() >= challenge.expiresAt) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'challenge expired',
        });
      }

      if (challenge.used) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'challenge used',
        });
      }

      const isValid = await crypto.subtle.verify(
        'Ed25519',
        challenge.publicKey,
        Buffer.from(input.signature, 'base64url'),
        Buffer.from(input.challenge, 'base64url'),
      );

      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'invalid signature',
        });
      }

      await kv.set(challengeKey, {
        ...challenge,
        used: true,
      });
      transition(ctx.auth, AuthState.DEVICE_PROVISIONAL_WITHOUT_CODE);
      assert(ctx.auth.state === AuthState.DEVICE_PROVISIONAL_WITHOUT_CODE);
      ctx.auth.publicKey = challenge.publicKey;
    }),
  requestPairingCode: telemetryProcedure
    .use(requireAuthState([AuthState.DEVICE_PROVISIONAL_WITHOUT_CODE]))
    .use(limitOncePerSession)
    .mutation(async ({ ctx }): Promise<string> => {
      const {
        services: { kv },
      } = ctx;
      const code = generatePairingCode();
      const telemetryId = crypto.randomUUID();
      await kv.set(navigatorKeys.pairing(code), {
        telemetryId,
        redeemed: false,
      });
      transition(ctx.auth, AuthState.DEVICE_PROVISIONAL_WITH_CODE);
      assert(ctx.auth.state === AuthState.DEVICE_PROVISIONAL_WITH_CODE);
      ctx.auth.pairingCode = code;

      return code;
    }),
  requestAdditionalPairingCode: telemetryProcedure
    .use(requireAuthState([AuthState.DEVICE_AUTHENTICATED]))
    .use(limitOncePerSession)
    .mutation(async ({ ctx }): Promise<string> => {
      assert(ctx.auth.state === AuthState.DEVICE_AUTHENTICATED);
      const {
        services: { kv },
      } = ctx;
      // TODO limit the number of "open" pairing codes out there
      const code = generatePairingCode();
      const telemetryId = ctx.auth.deviceId;
      await kv.set(navigatorKeys.pairing(code), {
        telemetryId,
        redeemed: false,
        cleanupOnRedemption: true,
      });
      return code;
    }),
  waitForPairing: telemetryProcedure
    .use(requireAuthState([AuthState.DEVICE_PROVISIONAL_WITH_CODE]))
    .use(limitOncePerSession)
    .subscription(async function* ({ ctx, signal }) {
      assert(ctx.auth.state === AuthState.DEVICE_PROVISIONAL_WITH_CODE);
      const {
        services: { kv },
      } = ctx;

      while (!signal?.aborted) {
        const { telemetryId, redeemed } = assertExists(
          await kv.get(navigatorKeys.pairing(ctx.auth.pairingCode)),
        );
        if (redeemed) {
          // TODO store this in a database.
          // link telemetryId to publicKey, to allow for reconnects.
          await kv.set(
            navigatorKeys.publicKey(telemetryId),
            ctx.auth.publicKey,
            {
              ttlMs: 12 * 60 * 60 * 1000,
            },
          );

          await kv.delete(navigatorKeys.pairing(ctx.auth.pairingCode));

          yield { telemetryId };
          transitionToAuthenticated(ctx.auth, telemetryId);
          return;
        }
        await delay(2000);
      }
    }),
  reconnect: telemetryProcedure
    .use(requireAuthState([AuthState.UNAUTHENTICATED]))
    .use(limitOncePerSession)
    .input(
      z.object({
        // i want to use `z.string().uuid()`, but it looks like it might be buggy.
        // https://github.com/colinhacks/zod/issues/91
        telemetryId: z.string().length(36), // length of UUID
        signature: z.string().max(200),
        timestamp: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const {
        services: { kv },
      } = ctx;
      const { telemetryId, timestamp, signature } = input;
      const publicKey = await kv.get(navigatorKeys.publicKey(telemetryId));
      if (!publicKey) {
        return false;
      }

      const now = Date.now();
      const isTimestampValid =
        now - 30_000 < timestamp && timestamp <= now + 5_000;
      if (!isTimestampValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: `invalid timestamp: min(${now - 30_000}) max(${now}) actual(${timestamp})}`,
        });
      }

      const isSignatureValid = await crypto.subtle.verify(
        'Ed25519',
        publicKey,
        Buffer.from(signature, 'base64url'),
        Buffer.from(JSON.stringify({ telemetryId, timestamp }), 'base64url'),
      );
      if (!isSignatureValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'invalid signature',
        });
      }

      restoreAuthenticatedState(ctx.auth, telemetryId);
      return true;
    }),
  // after ready signal is given, telemetry client pushes data
  push: telemetryProcedure
    .use(requireAuthState([AuthState.DEVICE_AUTHENTICATED]))
    .use(
      rateLimitMiddleware({
        maxCalls: 3,
        per: 'second',
      }),
    )
    .input(
      z.object({
        data: TruckSimTelemetrySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assert(ctx.auth.state === AuthState.DEVICE_AUTHENTICATED);
      const {
        services: { kv, sessionActors },
      } = ctx;
      const { data } = input;

      if (data.game.game.name !== 'ats') {
        throw new TRPCError({
          code: 'UNPROCESSABLE_CONTENT',
          message: `telemetry from game ${data.game.game.name} is unsupported.`,
        });
      }
      // TODO look for other sketchy data.

      // TODO restore "wait for viewers" flow

      const viewerCount = sessionActors.get(ctx.auth.deviceId)
        ?.attachedClientIds.size;
      if (!viewerCount) {
        return;
      }

      await kv.set(navigatorKeys.telemetry(ctx.auth.deviceId), data, {
        ttlMs: 2_000,
      });
    }),
});

function transitionToAuthenticated(
  authCtx: Context['auth'],
  telemetryId: string,
) {
  transition(authCtx, AuthState.DEVICE_AUTHENTICATED);
  assert(authCtx.state === AuthState.DEVICE_AUTHENTICATED);
  authCtx.deviceId = telemetryId;
}

function restoreAuthenticatedState(
  authCtx: Context['auth'],
  telemetryId: string,
) {
  // Do not call `transition`, because this is not a state transition: it's a
  // state restoration.
  authCtx.state = AuthState.DEVICE_AUTHENTICATED;
  assert(authCtx.state === AuthState.DEVICE_AUTHENTICATED);
  authCtx.deviceId = telemetryId;
}
