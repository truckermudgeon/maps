import { UnreachableError } from '@truckermudgeon/base/precon';
import {
  AtsSelectableDlcs,
  toAtsDlcGuards,
} from '@truckermudgeon/map/constants';
import type { RoutingService } from '../domain/actor/generate-routes';
import type { SearchService } from '../domain/actor/search';
import type { DomainEventSink } from '../domain/events';
import type { LookupData } from '../domain/lookup-data';
import { SessionActorRegistry } from './actors/registry';
import type { KvStore } from './kv/store';
import { createCacheableKv } from './kv/store';
import { logger } from './logging/logger';
import { loadLookupData } from './lookups/loader';
import type { MetricsService } from './metrics/service';
import { createMetricsService } from './metrics/service';
import type { RateLimitService } from './rate-limit/service';
import { createRateLimitService } from './rate-limit/service';
import { createRoutingService } from './routing/service';
import { createSearchService } from './search/service';

export interface Services {
  lookups: LookupData;
  domainEventSink: DomainEventSink;
  kv: KvStore;
  sessionActors: SessionActorRegistry;
  search: SearchService;
  routing: RoutingService;
  rateLimit: RateLimitService;
  metrics: MetricsService;
}

export function initServices(dataDir: string): Services {
  const lookups = loadLookupData(dataDir);
  const kv = createCacheableKv();
  const rateLimit = createRateLimitService(kv);
  const metrics = createMetricsService();
  const search = createSearchService(
    lookups.searchData,
    lookups.graphAndMapData.graphNodeRTree,
    metrics.worker,
  );
  const routing = createRoutingService(
    {
      graph: lookups.graphAndMapData.graphData.graph,
      nodeLUT: lookups.graphAndMapData.tsMapData.nodes,
      enabledDlcGuards: toAtsDlcGuards(AtsSelectableDlcs),
    },
    metrics.worker,
  );
  const domainEventSink: DomainEventSink = {
    publish(event) {
      let logMethod;
      switch (event.type) {
        case 'routeRecalculated':
        case 'info':
          logMethod = logger.info;
          break;
        case 'assertionFailed':
          logMethod = logger.warn;
          break;
        case 'error':
          logMethod = logger.error;
          break;
        default:
          throw new UnreachableError(event);
      }
      logMethod('domain event', { event });
    },
  };
  const sessionActors = new SessionActorRegistry({
    domainEventSink,
    maxClientsPerActor: 5,
    idleTtlMs: 10 * 60_000, // 10 minutes
    graphAndMapData: lookups.graphAndMapData,
    routing,
    kv,
    // TODO wire up create + delete metrics
    metrics,
    onCreate: actor => logger.info('created actor', actor.code),
    onDelete: (actor, reason) =>
      logger.info(`deleted actor (reason: ${reason})`, actor.code),
  });

  setInterval(() => {
    sessionActors.sweepIdle();
  }, 10_000);

  return {
    lookups,
    domainEventSink,
    kv,
    sessionActors,
    search,
    routing,
    rateLimit,
    metrics,
  };
}
