import type { Context, Route, RouteKey } from '@truckermudgeon/map/routing';
import { CacheableMemory } from 'cacheable';
import Tinypool from 'tinypool';
import type { RoutingService } from '../../domain/actor/generate-routes';
import type { MetricsService } from '../metrics/service';
import type { Options } from '../workers/find-route-worker';

type RouteOptions = Omit<Options, 'routeContext'>;

class RoutingServiceImpl implements RoutingService {
  private readonly routeCache = new CacheableMemory({
    ttl: '10m',
    lruSize: 1000,
  });

  constructor(
    private readonly router: (opts: RouteOptions) => Promise<Route>,
  ) {}

  async findRouteFromKey(key: RouteKey): Promise<Route> {
    if (this.routeCache.has(key)) {
      return Promise.resolve(this.routeCache.get<Route>(key)!);
    }

    const options: RouteOptions = { key };
    const route = await this.router(options);
    this.routeCache.set(key, route);
    return route;
  }
}

export function createRoutingService(
  context: Context,
  metrics: MetricsService['worker'],
): RoutingService {
  const pool = new Tinypool({
    maxThreads: 4,
    filename: new URL(
      '../workers/find-route-worker-wrapper.js',
      import.meta.url,
    ).href,
    workerData: {
      routeContext: context,
    },
  });
  const router = async (opts: RouteOptions): Promise<Route> => {
    const start = Date.now();
    const meta = { name: 'find-route' };
    try {
      metrics.workerCalls.inc(meta);
      return (await pool.run(opts)) as Route;
    } finally {
      metrics.workerDuration.observe(meta, Date.now() - start);
    }
  };
  return new RoutingServiceImpl(router);
}
