import { TRPCError } from '@trpc/server';
import { middleware } from '../init';

export const requireTelemetryContext = middleware(async ({ ctx, next }) => {
  if (ctx.type !== 'telemetry') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'No Telemetry context',
    });
  }

  return next({ ctx });
});
