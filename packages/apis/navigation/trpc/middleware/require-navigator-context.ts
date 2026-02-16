import { TRPCError } from '@trpc/server';
import { middleware } from '../init';

export const requireNavigatorContext = middleware(async ({ ctx, next }) => {
  if (ctx.type !== 'navigator') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'No Navigator context',
    });
  }

  return next({ ctx });
});
