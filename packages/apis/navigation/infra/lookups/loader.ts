import type { LookupData } from '../../domain/lookup-data';
import { readGraphAndMapData } from './graph-and-map';
import { readAndProcessSearchData } from './search';

export function loadLookupData(
  dataDir: string,
  map: 'usa' | 'europe',
): LookupData {
  const graphAndMapData = readGraphAndMapData(dataDir, map);
  const searchData = readAndProcessSearchData(dataDir, graphAndMapData);
  return {
    graphAndMapData,
    searchData,
  };
}
