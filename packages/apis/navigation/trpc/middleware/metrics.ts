import { middleware } from '../init';

export const metricsMiddleware = middleware(
  async ({ type, path, ctx, next }) => {
    const {
      metrics: { rpc: metrics },
    } = ctx.services;
    const start = Date.now();
    metrics.procedureCalls.inc({ path, type });

    try {
      const result = await next();

      const duration = Date.now() - start;
      metrics.procedureDuration.observe({ path, type }, duration);

      return result;
    } catch (err) {
      metrics.procedureErrors.inc({ path, type });
      throw err; // preserve original error
    }
  },
);
