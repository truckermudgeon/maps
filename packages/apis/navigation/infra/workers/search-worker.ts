import { PointRBush } from '@truckermudgeon/map/point-rbush';
import type { BBox } from 'rbush';
import type { SearchResult } from '../../types';

export interface Options {
  bbox: BBox;
  rbushJSON: unknown;
}

export default function (searchOptions: Options): SearchResult[] {
  const { bbox, rbushJSON } = searchOptions;
  const rTree = new PointRBush<{
    x: number;
    y: number;
    searchResult: SearchResult;
  }>().fromJSON(rbushJSON);
  return rTree.search(bbox).map(item => item.searchResult);
}
