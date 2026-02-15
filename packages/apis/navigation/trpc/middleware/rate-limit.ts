import { TRPCError } from '@trpc/server';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { rateLimitKeys } from '../../infra/kv/store';
import { middleware } from '../init';

type Interval = 'second' | 'minute' | 'hour' | 'day';

export interface RateLimitOptions {
  maxCalls: number;
  per: Interval;
}

export const rateLimitMiddleware = (options: RateLimitOptions) => {
  const { maxCalls, per } = options;
  return middleware(async ({ ctx, path, type, next }) => {
    const key = rateLimitKeys.rpc(ctx.clientId, path);
    if (
      !(await ctx.services.rateLimit.consume(key, {
        max: maxCalls,
        windowMs: intervalToMs(per),
      }))
    ) {
      ctx.services.metrics.rpc.procedureRateLimited.inc({
        path,
        type,
      });
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }

    return next();
  });
};

function intervalToMs(interval: Interval): number {
  switch (interval) {
    case 'second':
      return 1000;
    case 'minute':
      return 1000 * 60;
    case 'hour':
      return 1000 * 60 * 60;
    case 'day':
      return 1000 * 60 * 60 * 24;
    default:
      throw new UnreachableError(interval);
  }
}
