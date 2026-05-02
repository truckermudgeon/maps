import { fromZip } from '@truckermudgeon/io';
import {
  AtsSelectableDlcs,
  Ets2SelectableDlcs,
  toAtsDlcGuards,
  toEts2DlcGuards,
} from '@truckermudgeon/map/constants';
import path from 'node:path';
import type { LookupData } from '../../domain/lookup-data';
import { readGraphAndMapData } from './graph-and-map';
import { readAndProcessSearchData } from './search';

export function loadLookupData(
  dataDir: string,
  map: 'usa' | 'europe',
): LookupData {
  const source = fromZip(path.join(dataDir, `${map}-navigation.zip`));
  const graphAndMapData = readGraphAndMapData(source, map);
  const searchData = readAndProcessSearchData(source, graphAndMapData);
  return {
    graphAndMapData,
    searchData,
    allDlcGuards:
      map === 'usa'
        ? toAtsDlcGuards(AtsSelectableDlcs)
        : toEts2DlcGuards(Ets2SelectableDlcs),
  };
}
