import { middleware } from '../init';
import { inferGame } from './infer-game';

export const metricsMiddleware = middleware(
  async ({ type, path, ctx, next }) => {
    const {
      metrics: { rpc: metrics },
    } = ctx.services;
    const start = Date.now();
    const meta = {
      path,
      type,
      game: await inferGame(ctx, path),
    };
    metrics.procedureCalls.inc(meta);

    try {
      const result = await next();

      const duration = Date.now() - start;
      metrics.procedureDuration.observe(meta, duration);

      return result;
    } catch (err) {
      metrics.procedureErrors.inc(meta);
      throw err; // preserve original error
    }
  },
);
