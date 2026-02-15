import {
  AtsSelectableDlcs,
  toAtsDlcGuards,
} from '@truckermudgeon/map/constants';
import { EventEmitter } from 'events';
import path from 'node:path';
import url from 'node:url';
import { beforeAll } from 'vitest';
import { PoiType, ScopeType } from '../../../constants';
import { readGraphAndMapData } from '../../../infra/lookups/graph-and-map';
import { readAndProcessSearchData } from '../../../infra/lookups/search';
import { ConsoleWorkerMetrics } from '../../../infra/metrics/worker';
import { createRoutingService } from '../../../infra/routing/service';
import { createSearchService } from '../../../infra/search/service';
import type { SearchResult, TruckSimTelemetry } from '../../../types';
import type { DomainEventSink } from '../../events';
import type {
  GraphAndMapData,
  GraphMappedData,
  ProcessedSearchData,
} from '../../lookup-data';
import type { TelemetryEventEmitter } from '../../session-actor';
import { SessionActorImpl } from '../../session-actor';
import { generateRoutes, type RoutingService } from '../generate-routes';
import {
  createSearchRequest,
  createWithRelativeTruckInfoMapper,
} from '../search';
import { aTelemetryWith, aTruckWith } from './builders';

const dummyEventSink: DomainEventSink = {
  publish: () => void 0,
};

describe('searchPoi', () => {
  let graphAndMapData: GraphAndMapData<GraphMappedData>;
  let searchData: ProcessedSearchData;
  let routingService: RoutingService;
  beforeAll(() => {
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const outDir = path.join(__dirname, '../../../../../../out');
    graphAndMapData = readGraphAndMapData(outDir, 'usa');
    searchData = readAndProcessSearchData(outDir, graphAndMapData);
    routingService = createRoutingService(
      {
        nodeLUT: graphAndMapData.tsMapData.nodes,
        graph: graphAndMapData.graphData.graph,
        enabledDlcGuards: toAtsDlcGuards(AtsSelectableDlcs),
      },
      new ConsoleWorkerMetrics(),
    );
  }, 20_000);

  it('searches nearby POIs', async () => {
    const telemetryEventEmitter: TelemetryEventEmitter = new EventEmitter();
    const actor = new SessionActorImpl(
      'code',
      dummyEventSink,
      telemetryEventEmitter,
      graphAndMapData,
      routingService,
      100,
    );
    // GARC in Texarkana, TX
    const initialTelemetry: TruckSimTelemetry = aTelemetryWith({
      truck: aTruckWith({
        position: {
          X: 8515.3,
          Y: 5,
          Z: 31369.4,
        },
      }),
    });
    telemetryEventEmitter.emit('telemetry', initialTelemetry);

    const { readTelemetry, readActiveRoute } = actor;

    const addRelativeTruckInfo = createWithRelativeTruckInfoMapper(
      'usa',
      readTelemetry,
    );

    const searchRequest = createSearchRequest(
      ScopeType.NEARBY,
      PoiType.COMPANY,
      { readTelemetry, readActiveRoute },
    );

    const numIters = 1000;
    const start = Date.now();
    const searchService = createSearchService(
      searchData,
      graphAndMapData.graphNodeRTree,
      new ConsoleWorkerMetrics(),
    );
    let searchResults: SearchResult[] = [];
    for (let i = 0; i < numIters; i++) {
      searchResults = (await searchService.searchPoi(searchRequest)).map(
        addRelativeTruckInfo,
      );
    }
    // 1.95 seconds for 1000 iters
    // -> 0.227 after using r-tree
    // -> 0.790 after switching to thread pool that's run sequentially.
    console.log(
      numIters,
      'iters completed in',
      (Date.now() - start) / 1000,
      'seconds',
    );
    expect(searchResults.length).toBe(29);
  });

  it('searches along a route', async () => {
    const telemetryEventEmitter: TelemetryEventEmitter = new EventEmitter();
    const actor = new SessionActorImpl(
      'code',
      dummyEventSink,
      telemetryEventEmitter,
      graphAndMapData,
      routingService,
      100,
    );
    // GARC in Texarkana, TX
    const initialTelemetry: TruckSimTelemetry = aTelemetryWith({
      truck: aTruckWith({
        position: {
          X: 8515.3,
          Y: 5,
          Z: 31369.4,
        },
      }),
    });
    telemetryEventEmitter.emit('telemetry', initialTelemetry);
    const route = await generateRoutes(
      // ed_mkt in Aberdeen, WA
      0x5f76e26087050d0en,
      ['smallRoads'],
      {
        graphAndMapData,
        routing: routingService,
        truck: initialTelemetry.truck,
        domainEventSink: dummyEventSink,
      },
    );
    time('set active route', () => actor.setActiveRoute(route[0]));

    const { readTelemetry, readActiveRoute } = actor;

    const addRelativeTruckInfo = createWithRelativeTruckInfoMapper(
      'usa',
      readTelemetry,
    );

    const searchRequest = createSearchRequest(ScopeType.ROUTE, PoiType.FUEL, {
      readTelemetry,
      readActiveRoute,
    });

    const numIters = 5;
    const start = Date.now();
    const searchService = createSearchService(
      searchData,
      graphAndMapData.graphNodeRTree,
      new ConsoleWorkerMetrics(),
    );
    const results: SearchResult[][] = (
      await Promise.all(
        Array.from({ length: numIters }, () =>
          searchService.searchPoi(searchRequest),
        ),
      )
    ).map(rs => rs.map(addRelativeTruckInfo));

    // 42 seconds for 5 iters!
    // -> 8.058 seconds after pre-filtering with rhumbDistance
    // -> 4.317 seconds after searching along line chunks
    // -> 5.2 seconds after switching to sequential threadpool
    // -> 2.436 seconds after switching to parallel proc and moving reducer to thread pool
    console.log(
      numIters,
      'completed in',
      (Date.now() - start) / 1000,
      'seconds',
      `(${results[0].length} results)`,
    );
    expect(results[0].length).toBe(58);
  }, 10_000);
});

function time<T>(log: string, fn: () => T): T {
  const start = Date.now();
  const res = fn();
  console.log(`${log}:`, (Date.now() - start) / 1000, 'seconds');
  return res;
}
