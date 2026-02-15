import { env } from '../../env';
import type { KvKey, KvStore } from '../kv/store';
import { rateLimitKeys } from '../kv/store';

export interface RateLimitService {
  wsUpgrade(ip: string): Promise<boolean>;

  wsConnect(ip: string): Promise<boolean>;

  wsDisconnect(ip: string): Promise<void>;

  consume(
    key: string,
    opts: { max: number; windowMs: number },
  ): Promise<boolean>;
}

const resolveTrue = () => Promise.resolve(true);

// returns fixed-window rate-limiting service.
export function createRateLimitService(kv: KvStore): RateLimitService {
  return env.RATE_LIMIT_ENABLED
    ? {
        // 10/minute
        wsUpgrade: async (ip: string) => {
          const key = rateLimitKeys.wsUpgrade(ip);

          const count = await kv.incr(key);
          if (count === 1) {
            await kv.expire(key, 60);
          }

          return count <= 10;
        },

        // 5 concurrent/week
        wsConnect: async (ip: string) => {
          const key = rateLimitKeys.wsConnect(ip);

          const count = await kv.incr(key);
          if (count === 1) {
            await kv.expire(key, 60 * 60 * 24 * 7); // 1 week
          }

          if (count <= 5) {
            return true;
          } else {
            await kv.decr(key);
            return false;
          }
        },

        wsDisconnect: async (ip: string) => {
          const key = rateLimitKeys.wsConnect(ip);

          const count = await kv.decr(key);
          if (count === 0) {
            await kv.delete(key);
          }
        },

        consume: async (
          key: KvKey<'rpc'>,
          opts: { max: number; windowMs: number },
        ) => {
          const count = await kv.incr(key);
          if (count === 1) {
            await kv.expire(key, Math.ceil(opts.windowMs / 1000));
          }

          return count <= opts.max;
        },
      }
    : {
        wsUpgrade: resolveTrue,
        wsConnect: resolveTrue,
        wsDisconnect: () => Promise.resolve(),
        consume: resolveTrue,
      };
}
