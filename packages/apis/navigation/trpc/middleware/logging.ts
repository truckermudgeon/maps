import { TRPCError } from '@trpc/server';
import { logger } from '../../infra/logging/logger';
import { middleware } from '../init';

const ignoreOkResultPaths: ReadonlySet<string> = new Set(['telemetry.push']);

export const loggingMiddleware = middleware(
  async ({ path, type, ctx, next }) => {
    const start = performance.now();
    const baseInfo = {
      trpc: {
        path,
        type,
      },
      request: {
        type: ctx.type,
        clientId: ctx.clientId,
      },
    };

    try {
      const result = await next();

      const durationMs = Math.round(performance.now() - start);

      if (result.ok) {
        if (!ignoreOkResultPaths.has(path)) {
          logger.info('tRPC request completed', {
            ...baseInfo,
            trpc: {
              ...baseInfo.trpc,
              durationMs,
            },
          });
        }
      } else {
        logger.warn('tRPC request failed', {
          ...baseInfo,
          trpc: {
            ...baseInfo.trpc,
            durationMs,
            errorCode: result.error.code,
          },
          error: {
            message: result.error.message,
          },
        });
      }

      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);

      if (err instanceof TRPCError) {
        logger.error('tRPC request threw TRPCError', {
          ...baseInfo,
          trpc: {
            ...baseInfo.trpc,
            durationMs,
            errorCode: err.code,
          },
          error: {
            message: err.message,
            cause: err.cause,
          },
        });
      } else {
        logger.error('tRPC request threw unknown error', {
          ...baseInfo,
          trpc: {
            ...baseInfo.trpc,
            durationMs,
          },
          error: err,
        });
      }

      throw err;
    }
  },
);
