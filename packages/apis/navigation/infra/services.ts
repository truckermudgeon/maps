import { UnreachableError } from '@truckermudgeon/base/precon';
import type { RoutingService } from '../domain/actor/generate-routes';
import type { SearchService } from '../domain/actor/search';
import type { DomainEventSink } from '../domain/events';
import type { GameContext } from '../domain/game-context';
import type { LookupData } from '../domain/lookup-data';
import { SessionActorRegistry } from './actors/registry';
import type { KvStore } from './kv/store';
import { createCacheableKv } from './kv/store';
import { logger } from './logging/logger';
import { loadLookupData } from './lookups/loader';
import { LookupServiceImpl } from './lookups/service';
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
  const lookups = new LookupServiceImpl(
    loadLookupData(dataDir, 'usa'),
    loadLookupData(dataDir, 'europe'),
  );
  const _lookups = lookups.getData({ game: 'usa' });

  const kv = createCacheableKv();
  const rateLimit = createRateLimitService(kv);
  const metrics = createMetricsService();
  const search = createSearchService(lookups, metrics.worker);
  const routing = createRoutingService(lookups, metrics.worker);
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
    getGraphAndMapData: (gameContext: GameContext) =>
      lookups.getData(gameContext).graphAndMapData,
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
    lookups: _lookups,
    domainEventSink,
    kv,
    sessionActors,
    search,
    routing,
    rateLimit,
    metrics,
  };
}
