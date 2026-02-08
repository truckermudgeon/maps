import { z } from 'zod';
import { TruckSimTelemetrySchema } from '../../domain/schemas';
import { publicProcedure, router } from '../init';

const telemetryProcedure = publicProcedure;

/** Router for the desktop telemetry client */
export const telemetryRouter = router({
  issueChallenge: telemetryProcedure
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
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  verifyChallenge: telemetryProcedure
    .input(
      z.object({
        challenge: z.string().max(200),
        signature: z.string().max(200),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<void> => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  requestPairingCode: telemetryProcedure.mutation(
    async ({ ctx }): Promise<string> => {
      console.log(ctx);
      return Promise.reject(new Error('unimplemented'));
    },
  ),
  requestAdditionalPairingCode: telemetryProcedure.mutation(
    async ({ ctx }): Promise<string> => {
      console.log(ctx);
      return Promise.reject(new Error('unimplemented'));
    },
  ),
  waitForPairing: telemetryProcedure.subscription(async function* ({
    ctx,
    signal,
  }) {
    console.log(ctx, signal);
    yield Promise.reject(new Error('unimplemented'));
  }),
  reconnect: telemetryProcedure
    .input(
      z.object({
        // i want to use `z.string().uuid()`, but it looks like it might be buggy.
        // https://github.com/colinhacks/zod/issues/91
        telemetryId: z.string().length(36), // length of UUID
        signature: z.string().max(200),
        timestamp: z.number(),
      }),
    )
    .mutation<boolean>(async ({ ctx, input }) => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  // after ready signal is given, telemetry client pushes data
  push: telemetryProcedure
    .input(
      z.object({
        data: TruckSimTelemetrySchema,
      }),
    )
    .mutation<void>(async ({ ctx, input }) => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
});
