// TODO ensure no imports from infra

import type { Position } from '@truckermudgeon/base/geom';
import type {
  MapDataKeys,
  MappedDataForKeys,
} from '@truckermudgeon/generator/mapped-data';
import type { PointRBush } from '@truckermudgeon/map/point-rbush';
import type {
  CompanyItem,
  Country,
  GraphData,
  Node,
  Poi,
  Prefab,
  Road,
  Sign,
} from '@truckermudgeon/map/types';
import type RBush from 'rbush';
import { type BBox } from 'rbush';
import type { SearchResult } from '../types';
import { detectRouteMapDataKeys } from './actor/detect-route-events';
import { generateRoutesMapDataKeys } from './actor/generate-routes';
import { searchMapDateKeys } from './actor/search';

export interface GraphAndMapData<T = unknown> {
  tsMapData: T;
  graphData: GraphData;
  graphCompaniesByNodeUid: ReadonlyMap<bigint, CompanyItem>;
  // TODO is this really needed? can the data it provides be better provided
  //  by, e.g., the roadAndPrefabRTree?
  graphNodeRTree: PointRBush<{
    x: number;
    y: number;
    z: number;
    node: Node;
  }>;
  /**
   * R-tree of all non-hidden roads in game map. Each road has two entries:
   * one for road's start point, one for road's end point.
   */
  roadRTree: PointRBush<{
    x: number;
    y: number;
    nodeUid: bigint;
    road: Road;
    startPos: { x: number; y: number };
    endPos: { x: number; y: number };
  }>;
  signRTree: PointRBush<{
    x: number;
    y: number;
    sign: Sign;
    type: 'exit' | 'name' | 'roadNumber';
  }>;
  roadAndPrefabRTree: RBush<
    BBox & {
      item: Road | Prefab;
      lines: Position[][];
    }
  >;
  poiRTree: PointRBush<{
    x: number;
    y: number;
    lngLat: [number, number];
    poi: Poi & { type: 'road' };
  }>;
}

export const graphMapDataKeys = [
  ...detectRouteMapDataKeys,
  ...generateRoutesMapDataKeys,
  ...searchMapDateKeys,
  'signDescriptions',
  'signs',
  'pois',
] satisfies MapDataKeys;

export type GraphMappedData = MappedDataForKeys<typeof graphMapDataKeys>;

export interface SearchIndices {
  nodePointRTree: PointRBush<{
    x: number;
    y: number;
    node: Node;
  }>;
  cityRTree: RBush<
    BBox & {
      cityName: string;
      stateCode: string;
    }
  >;
  cityPointRTree: PointRBush<{
    x: number;
    y: number;
    cityName: string;
    stateCode: string;
  }>;
  countriesById: ReadonlyMap<number, Country>;
  searchDataLngLatRTreeJSON: unknown; // JSON exported from a PointRBush<{x: number; y: number; searchResult: SearchResult}>
}

export type ProcessedSearchData = {
  searchData: (SearchResult & { description?: string })[];
} & SearchIndices;

export interface LookupData {
  graphAndMapData: GraphAndMapData<GraphMappedData>;
  searchData: ProcessedSearchData;
}
