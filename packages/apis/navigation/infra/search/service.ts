import type { PointRBush } from '@truckermudgeon/map/point-rbush';
import type { Node } from '@truckermudgeon/map/types';
import type { BBox } from 'rbush';
import Tinypool from 'tinypool';
import type { SearchReducerOptions } from '../../domain/actor/search';
import { SearchService } from '../../domain/actor/search';
import type { ProcessedSearchData } from '../../domain/lookup-data';
import type { SearchResult } from '../../types';
import type { MetricsService } from '../metrics/service';

export function createSearchService(
  searchData: ProcessedSearchData,
  graphNodeRTree: PointRBush<{ x: number; y: number; z: number; node: Node }>,
  metrics: MetricsService['worker'],
): SearchService {
  const searcherPool = new Tinypool({
    maxThreads: 4,
    filename: new URL('../workers/search-worker-wrapper.js', import.meta.url)
      .href,
    workerData: {
      rbushJSON: searchData.searchDataLngLatRTreeJSON,
    },
  });
  const searcher = async (bbox: BBox): Promise<SearchResult[]> => {
    const start = Date.now();
    const meta = { name: 'search' };
    try {
      metrics.workerCalls.inc(meta);
      return (await searcherPool.run({ bbox })) as SearchResult[];
    } finally {
      metrics.workerDuration.observe(meta, Date.now() - start);
    }
  };

  const reducerPool = new Tinypool({
    maxThreads: 4,
    filename: new URL(
      '../workers/search-results-worker-wrapper.js',
      import.meta.url,
    ).href,
    workerData: {
      rbushJSON: searchData.searchDataLngLatRTreeJSON,
    },
  });
  const reducer = async (
    opts: SearchReducerOptions,
  ): Promise<SearchResult[]> => {
    const start = Date.now();
    const meta = { name: 'search-results-reducer' };
    try {
      metrics.workerCalls.inc(meta);
      return (await reducerPool.run(opts)) as SearchResult[];
    } finally {
      metrics.workerDuration.observe(meta, Date.now() - start);
    }
  };

  return new SearchService(searchData, searcher, reducer, graphNodeRTree);
}
