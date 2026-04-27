import { readRoundaboutsData } from '@truckermudgeon/io';
import {
  AtsSelectableDlcs,
  Ets2SelectableDlcs,
  toAtsDlcGuards,
  toEts2DlcGuards,
} from '@truckermudgeon/map/constants';
import type { RoundaboutData } from '@truckermudgeon/map/types';
import type { LookupData } from '../../domain/lookup-data';
import { readGraphAndMapData } from './graph-and-map';
import { readAndProcessSearchData } from './search';

export function loadLookupData(
  dataDir: string,
  map: 'usa' | 'europe',
): LookupData {
  const graphAndMapData = readGraphAndMapData(dataDir, map);
  const searchData = readAndProcessSearchData(dataDir, graphAndMapData);
  let roundaboutData: RoundaboutData;
  try {
    roundaboutData = readRoundaboutsData(dataDir, map);
  } catch {
    console.warn(`could not find ${map} roundabout data`);
    roundaboutData = {
      descs: [],
      descsIndex: new Map(),
      prefabTokens: new Set(),
    };
  }
  return {
    graphAndMapData,
    searchData,
    roundaboutData,
    allDlcGuards:
      map === 'usa'
        ? toAtsDlcGuards(AtsSelectableDlcs)
        : toEts2DlcGuards(Ets2SelectableDlcs),
  };
}
