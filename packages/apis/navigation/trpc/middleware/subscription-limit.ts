import { TRPCError } from '@trpc/server';
import {
  isObservable,
  observableToAsyncIterable,
} from '@trpc/server/observable';
import { isAsyncIterable } from '@trpc/server/unstable-core-do-not-import';
import { assert } from '@truckermudgeon/base/assert';
import { logger } from '../../infra/logging/logger';
import { middleware } from '../init';

export const subscriptionLimitMiddleware = (max: number) => {
  return middleware(async ({ ctx, path, type, signal, next }) => {
    if (type !== 'subscription') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `subscription middleware used on ${type}`,
      });
    }

    const { wsConnectionState: state } = ctx;
    let activeSubscriptions = state.subscriptions.get(path) ?? 0;

    if (activeSubscriptions >= max) {
      logger.warn('Subscription limit exceeded', {
        path,
        active: activeSubscriptions,
        limit: max,
      });

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many active subscriptions on this connection',
      });
    }

    activeSubscriptions++;
    state.subscriptions.set(path, activeSubscriptions);

    let result: Awaited<ReturnType<typeof next>>;
    try {
      result = await next();
    } catch (err) {
      // Roll back if the subscription never started
      decrement(path, state.subscriptions);
      throw err;
    }

    if (!result.ok) {
      return result;
    }

    const dataAsIterable = isObservable(result.data)
      ? observableToAsyncIterable(
          result.data,
          signal ?? new AbortController().signal,
        )
      : (result.data as AsyncIterable<unknown>);

    assert(isAsyncIterable(dataAsIterable));
    return {
      ...result,
      data: (async function* () {
        try {
          for await (const value of dataAsIterable) {
            yield value;
          }
        } finally {
          // Runs on:
          // - client unsubscribe
          // - socket close
          // - iterator error
          decrement(path, state.subscriptions);
        }
      })(),
    };
  });
};

function decrement(key: string, map: Map<string, number>) {
  const remaining = (map.get(key) ?? 1) - 1;
  if (remaining <= 0) {
    map.delete(key);
  } else {
    map.set(key, remaining);
  }
}
