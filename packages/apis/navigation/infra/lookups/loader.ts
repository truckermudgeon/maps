import type { LookupData } from '../../domain/lookup-data';
import { readGraphAndMapData } from './graph-and-map';
import { readAndProcessSearchData } from './search';

export function loadLookupData(dataDir: string): LookupData {
  const graphAndMapData = readGraphAndMapData(dataDir, 'usa');
  const searchData = readAndProcessSearchData(dataDir, graphAndMapData);
  return {
    graphAndMapData,
    searchData,
  };
}
