import Tinypool from 'tinypool';
import type {
  SearchReducerOptions,
  SearchSearcherOptions,
  SearchService,
} from '../../domain/actor/search';
import { SearchServiceImpl } from '../../domain/actor/search';
import type { GameContext } from '../../domain/game-context';
import type { LookupService } from '../../domain/lookup-data';
import type { SearchResult } from '../../types';
import type { MetricsService } from '../metrics/service';

// searchData: ProcessedSearchData,
// graphNodeRTree: PointRBush<{ x: number; y: number; z: number; node: Node }>,

export function createSearchService(
  lookups: LookupService,
  metrics: MetricsService['worker'],
): SearchService {
  const [atsSearcherPool, ets2SearcherPool] = (['usa', 'europe'] as const).map(
    game =>
      new Tinypool({
        maxThreads: 4,
        filename: new URL(
          '../workers/search-worker-wrapper.js',
          import.meta.url,
        ).href,
        workerData: {
          rbushJSON: lookups.getData({ game }).searchData
            .searchDataLngLatRTreeJSON,
        },
      }),
  );
  const searcher = async (
    opts: SearchSearcherOptions,
  ): Promise<SearchResult[]> => {
    const start = Date.now();
    const meta = { name: 'search', game: opts.gameContext.game };
    try {
      metrics.workerCalls.inc(meta);
      const pool =
        opts.gameContext.game === 'usa' ? atsSearcherPool : ets2SearcherPool;
      return (await pool.run({ bbox: opts.bbox })) as SearchResult[];
    } finally {
      metrics.workerDuration.observe(meta, Date.now() - start);
    }
  };

  const [atsReducerPool, ets2ReducerPool] = (['usa', 'europe'] as const).map(
    game =>
      new Tinypool({
        maxThreads: 4,
        filename: new URL(
          '../workers/search-results-worker-wrapper.js',
          import.meta.url,
        ).href,
        workerData: {
          rbushJSON: lookups.getData({ game }).searchData
            .searchDataLngLatRTreeJSON,
        },
      }),
  );
  const reducer = async (
    opts: SearchReducerOptions,
  ): Promise<SearchResult[]> => {
    const start = Date.now();
    const meta = {
      name: 'search-results-reducer',
      game: opts.gameContext.game,
    };
    try {
      metrics.workerCalls.inc(meta);
      const pool =
        opts.gameContext.game === 'usa' ? atsReducerPool : ets2ReducerPool;
      return (await pool.run(opts)) as SearchResult[];
    } finally {
      metrics.workerDuration.observe(meta, Date.now() - start);
    }
  };

  const getLookup = (gameContext: GameContext) => ({
    processedSearchData: lookups.getData(gameContext).searchData,
    graphNodeRTree: lookups.getData(gameContext).graphAndMapData.graphNodeRTree,
  });

  return new SearchServiceImpl(searcher, reducer, getLookup);
}
