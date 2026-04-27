import {
  AtsSelectableDlcs,
  Ets2SelectableDlcs,
  toAtsDlcGuards,
  toEts2DlcGuards,
} from '@truckermudgeon/map/constants';
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
    allDlcGuards:
      map === 'usa'
        ? toAtsDlcGuards(AtsSelectableDlcs)
        : toEts2DlcGuards(Ets2SelectableDlcs),
  };
}
