import polyline from '@mapbox/polyline';
import { assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { distance } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { MapDataKeys } from '@truckermudgeon/generator/mapped-data';
import type { PointRBush } from '@truckermudgeon/map/point-rbush';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
  fromWgs84ToAtsCoords,
  fromWgs84ToEts2Coords,
  lengthOfDegree,
} from '@truckermudgeon/map/projections';
import type {
  FacilityIcon,
  Node,
  SearchPoiProperties,
  SearchProperties,
} from '@truckermudgeon/map/types';
import bbox from '@turf/bbox';
import bearing from '@turf/bearing';
import cleanCoords from '@turf/clean-coords';
import { lineString } from '@turf/helpers';
import lineChunk from '@turf/line-chunk';
import type { Expression, FuseSortFunctionArg } from 'fuse.js';
import Fuse from 'fuse.js';
import type { GeoJSON } from 'geojson';
import type { BBox } from 'rbush';
import { PoiType, ScopeType } from '../../constants';
import type {
  JobState,
  Route,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
  TruckSimTelemetry,
} from '../../types';
import type { ProcessedSearchData, SearchIndices } from '../lookup-data';
import type { RouteWithLookup } from './generate-routes';

const searchRadiusMeters = 6_000;

export type SearchRequest =
  | {
      scope: ScopeType.ROUTE;
      poiType: PoiType;
      point: [gameX: number, gameY: number];
      route: Route;
    }
  | {
      scope: ScopeType.NEARBY;
      poiType: PoiType;
      point: [gameX: number, gameY: number];
    };

export const searchMapDateKeys = [
  'nodes',
  'cities',
  'countries',
  'companyDefs',
  'prefabs',
] satisfies MapDataKeys;

export function createSearchRequest(
  scope: ScopeType,
  poiType: PoiType,
  {
    readTelemetry,
    readActiveRoute,
  }: {
    readTelemetry: () => TruckSimTelemetry | undefined;
    readActiveRoute: () => Route | undefined;
  },
): SearchRequest {
  const telemetry = readTelemetry();
  if (!telemetry) {
    throw new Error('no truck position available for search');
  }
  switch (scope) {
    case ScopeType.NEARBY: {
      return {
        scope,
        poiType,
        point: [telemetry.truck.position.X, telemetry.truck.position.Z],
      };
    }
    case ScopeType.ROUTE: {
      const activeRoute = readActiveRoute();
      if (!activeRoute) {
        throw new Error('no active route for "route" search');
      }
      return {
        scope,
        poiType,
        point: [telemetry.truck.position.X, telemetry.truck.position.Z],
        route: activeRoute,
      };
    }
    default:
      throw new UnreachableError(scope);
  }
}

export function createWithRelativeTruckInfoMapper(
  map: 'usa' | 'europe',
  readTelemetry: () => TruckSimTelemetry | undefined,
): (searchResult: SearchResult) => SearchResultWithRelativeTruckInfo {
  const toGameCoord =
    map === 'usa' ? fromWgs84ToAtsCoords : fromWgs84ToEts2Coords;
  const toLngLat = map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;

  const truck = assertExists(readTelemetry()).truck;
  const { X: truckX, Z: truckY } = truck.position;
  const truckLngLat = toLngLat([truckX, truckY]);

  return (searchResult: SearchResult) => ({
    ...searchResult,
    distance: distance([truckX, truckY], toGameCoord(searchResult.lonLat)),
    bearing: bearing(truckLngLat, searchResult.lonLat, { final: false }),
  });
}

export function toBaseProperties(
  node: Node,
  context: Omit<SearchIndices, 'searchDataLngLatRTreeJSON'>,
): Pick<SearchPoiProperties, 'dlcGuard' | 'stateName' | 'stateCode' | 'city'> {
  const { nodePointRTree, cityRTree, cityPointRTree, countriesById } = context;
  const closestNode = nodePointRTree.findClosest(node.x, node.y).node;
  const country =
    countriesById.get(closestNode.forwardCountryId) ??
    countriesById.get(closestNode.backwardCountryId);

  if (!country) {
    console.error('unknown country for node. treating as unknown');
    return {
      dlcGuard: 0,
      stateName: 'unknown State',
      stateCode: '??',
      city: {
        name: 'unknown city',
        stateCode: '??',
        distance: 0,
      },
    };
  }

  const containingCity = cityRTree
    .search({
      minX: node.x,
      minY: node.y,
      maxX: node.x,
      maxY: node.y,
    })
    .find(c => c.stateCode === country.code);
  const nearestCity = cityPointRTree.findClosest(node.x, node.y, {
    predicate: c => c.stateCode === country.code,
  });
  const city = containingCity
    ? {
        name: containingCity.cityName,
        stateCode: containingCity.stateCode,
        distance: 0,
      }
    : {
        name: nearestCity.cityName,
        stateCode: nearestCity.stateCode,
        distance: distance(nearestCity, node),
      };

  return {
    dlcGuard: 0, // TODO
    stateName: country.name,
    stateCode: country.code,
    city,
  };
}

const searchPropertyPriority: Record<SearchProperties['type'], number> = {
  company: 0,
  city: 1,
  scenery: 1,
  landmark: 2,
  viewpoint: 3,
  dealer: 4,
  ferry: 5,
  train: 6,
  serviceArea: 7,
};

export interface SearchReducerOptions {
  truckLngLat: [number, number];
  searchResults: SearchResult[];
  routeLine: GeoJSON.Feature<GeoJSON.LineString>;
  /**
   * max real-world (not in-game) distance a search result can be from
   * `routeLine`
   */
  distanceKm: number;
}

export class SearchService {
  // This helper, and the code for multi-token searches using Fuse.js, from:
  // https://stackoverflow.com/a/67736057
  private static readonly tokenizeStringWithQuotesBySpaces = (
    string: string,
  ): string[] => string.match(/("[^"]*?"|[^"\s]+)+(?=\s*|\s*$)/g) ?? [];

  private readonly fuse: Fuse<SearchResult>;

  constructor(
    private readonly processedSearchData: ProcessedSearchData,
    private readonly searcher: (bbox: BBox) => Promise<SearchResult[]>,
    private readonly reducer: (
      opts: SearchReducerOptions,
    ) => Promise<SearchResult[]>,
    private readonly graphNodeRTree: PointRBush<{
      x: number;
      y: number;
      z: number;
      node: Node;
    }>,
  ) {
    this.fuse = new Fuse<SearchResult>(
      processedSearchData.searchData.map(s => ({
        ...s,
        tags: s.tags.concat(s.description ? [s.description] : []),
      })),
      {
        distance: 0,
        threshold: 0.2,
        findAllMatches: true,
        ignoreLocation: true, // so that 'san francisco' can be searched for without quotes
        sortFn: sortSearchResults,
        keys: [
          { name: 'label', weight: 3 },
          { name: 'city.name', weight: 2 },
          { name: 'stateName', weight: 1.5 },
          'stateCode',
          'tags',
        ],
      },
    );

    const missingLabels = processedSearchData.searchData.filter(
      s => s.label == null,
    );
    if (missingLabels.length) {
      console.log(missingLabels);
      throw new Error();
    }
  }

  async search(
    input: string,
    maxSearchResults: number,
    context: {
      truckLngLat: Position | undefined;
      activeJob: JobState | undefined;
      activeRoute: RouteWithLookup | undefined;
    },
  ): Promise<SearchResult[]> {
    const fuseResults = this.fuse.search({
      $and: SearchService.tokenizeStringWithQuotesBySpaces(input).map(
        (searchToken: string) => {
          const orFields: Expression[] = [
            { label: searchToken },
            { 'city.name': searchToken },
            { stateName: searchToken },
            { stateCode: searchToken },
            { tags: searchToken },
          ];
          return {
            $or: orFields,
          };
        },
      ),
    });

    const { truckLngLat, activeRoute, activeJob } = context;
    const jobDestResultIndex = activeJob
      ? fuseResults.findIndex(res => res.item.nodeUid === activeJob.toNodeUid)
      : -1;
    const jobResultNodeUid =
      jobDestResultIndex >= 0
        ? fuseResults[jobDestResultIndex].item.nodeUid
        : undefined;
    const isRoutingToJob = activeRoute?.lookup.nodeUidsSet.has(
      BigInt(`0x${jobResultNodeUid ?? 0}`),
    );

    const jobResult =
      !isRoutingToJob && jobDestResultIndex >= 1
        ? fuseResults.splice(jobDestResultIndex, 1)[0].item
        : undefined;

    let results: SearchResult[];
    if (truckLngLat && activeRoute) {
      const routeLine = cleanCoords(
        lineString(
          activeRoute.segments.flatMap(segment =>
            segment.steps.flatMap(step => polyline.decode(step.geometry)),
          ),
        ),
      ) as unknown as GeoJSON.Feature<GeoJSON.LineString>;
      results = await this.searchAlongLine(routeLine);
      console.log(results.length, 'items in rough range of line');

      const fuseResultIds = new Set(fuseResults.map(r => r.item.id));
      results = results.filter(r => fuseResultIds.has(r.id));
      console.log(results.length, 'items after filtering by fuse');

      results = await this.reducer({
        searchResults: results,
        truckLngLat,
        routeLine,
        distanceKm: 48, // 48 km away from route, or ~1.5 miles in game units
      });
    } else if (truckLngLat) {
      results = fuseResults
        .sort((a, b) => {
          if (a.score !== b.score) {
            return (b.score ?? 0) - (a.score ?? 0);
          }

          const distA = distance(truckLngLat, a.item.lonLat);
          const distB = distance(truckLngLat, b.item.lonLat);
          return distA - distB;
        })
        .map(res => res.item);
    } else {
      results = fuseResults.map(res => res.item);
    }

    if (jobResult) {
      results.unshift(jobResult);
    }

    return results.slice(0, maxSearchResults).map(s => {
      const sd = s as SearchResult & {
        description?: string;
      };
      return {
        ...s,
        label: sd.description ?? s.label,
      };
    });
  }

  async searchPoi(request: SearchRequest): Promise<SearchResult[]> {
    let results: SearchResult[];
    switch (request.scope) {
      case ScopeType.NEARBY:
        results = await this.searchPoiNearby(request);
        break;
      case ScopeType.ROUTE:
        results = await this.searchPoiAlongRoute(request);
        break;
      default:
        throw new UnreachableError(request);
    }

    return results.map(s => {
      const sd = s as SearchResult & {
        description?: string;
      };
      return {
        ...s,
        label: sd.description ?? s.label,
      };
    });
  }

  /**
   * Synthesizes a search result for the given lon-lat point. Used as a hack for
   * waypoint routing, because the navigation API + navigator UI only understand
   * SearchResults.
   */
  synthesizeSearchResult(lonLat: [number, number]): SearchResult {
    const gameCoords = fromWgs84ToAtsCoords(lonLat);
    const closestNode = this.graphNodeRTree.findClosest(...gameCoords).node;
    // TODO check if closestNode is company node or service area node.

    return {
      // TODO add something to describe an arbitrary point, instead of mis-using
      //  the 'serviceArea' result type.
      id: Math.random(),
      type: 'serviceArea',
      nodeUid: closestNode.uid.toString(16),
      lonLat,
      facilityUrls: [],
      tags: [],
      label: 'Waypoint',
      sprite: 'marker',
      ...toBaseProperties(closestNode, this.processedSearchData),
    };
  }

  private async searchPoiNearby(
    request: SearchRequest & { scope: ScopeType.NEARBY },
  ): Promise<SearchResult[]> {
    const { point, poiType } = request;

    const [lng, lat] = fromAtsCoordsToWgs84(point);
    return SearchService.filterSearchDataByPoi(
      await this.searcher({
        // N.B.: ran into some precision issues when trying to use a delta
        // of `searchRadiusMeters / lengthOfDegree`; r-tree search returned 0.
        // so use a generous delta of 1 degree, and filter by distance later.
        minX: lng - 1,
        minY: lat - 1,
        maxX: lng + 1,
        maxY: lat + 1,
      }),
      poiType,
    )
      .filter(s => {
        const poiGame = fromWgs84ToAtsCoords(s.lonLat);
        return distance(poiGame, point) <= searchRadiusMeters;
      })
      .sort(
        (a, b) =>
          distance(fromWgs84ToAtsCoords(a.lonLat), point) -
          distance(fromWgs84ToAtsCoords(b.lonLat), point),
      );
  }

  private async searchPoiAlongRoute(
    request: SearchRequest & { scope: ScopeType.ROUTE },
  ): Promise<SearchResult[]> {
    const { route, poiType, point } = request;
    const routeLine = cleanCoords(
      lineString(
        route.segments.flatMap(segment =>
          segment.steps.flatMap(step => polyline.decode(step.geometry)),
        ),
      ),
    ) as unknown as GeoJSON.Feature<GeoJSON.LineString>;
    const uniqueResults = await this.searchAlongLine(routeLine);
    const inBoxResults = SearchService.filterSearchDataByPoi(
      uniqueResults,
      poiType,
    );
    return this.reducer({
      searchResults: inBoxResults,
      truckLngLat: fromAtsCoordsToWgs84(point),
      routeLine,
      distanceKm: 48, // 48 km away from route, or ~1.5 miles in game units
    });
  }

  private async searchAlongLine(
    lineString: GeoJSON.Feature<GeoJSON.LineString>,
  ): Promise<SearchResult[]> {
    const deltaDeg = 50_000 / lengthOfDegree;
    const bboxes = lineChunk(lineString, 200, {
      units: 'kilometers',
    }).features.map(lsf => {
      const [minX, minY, maxX, maxY] = bbox(lsf);
      return [
        minX - deltaDeg,
        minY - deltaDeg,
        maxX + deltaDeg,
        maxY + deltaDeg,
      ];
    });

    const results = (
      await Promise.all(
        bboxes.map(([minX, minY, maxX, maxY]) =>
          this.searcher({ minX, minY, maxX, maxY }),
        ),
      )
    ).flat();
    return [...new Map(results.map(r => [r.id, r])).values()];
  }

  // TODO can signature of filterSearchDataByPoi change, given how it's used?
  private static filterSearchDataByPoi(
    searchData: SearchResult[],
    poiType: PoiType,
  ): SearchResult[] {
    switch (poiType) {
      case PoiType.COMPANY: {
        return searchData.filter(s => s.type === 'company');
      }
      case PoiType.DEALER:
        return searchData.filter(s => s.type === 'dealer');
      case PoiType.FUEL:
      case PoiType.REST:
      case PoiType.SERVICE:
      case PoiType.RECRUITING: {
        const iconMap: Record<typeof poiType, FacilityIcon> = {
          [PoiType.FUEL]: 'gas_ico',
          [PoiType.REST]: 'parking_ico',
          [PoiType.SERVICE]: 'service_ico',
          [PoiType.RECRUITING]: 'recruitment_ico',
        };
        const icon = iconMap[poiType];
        return searchData.filter(
          s =>
            s.type === 'serviceArea' &&
            s.facilityUrls.some(url => url.endsWith(`/${icon}.png`)),
        );
      }
      default:
        throw new UnreachableError(poiType);
    }
  }
}

function sortSearchResults(
  a: FuseSortFunctionArg,
  b: FuseSortFunctionArg,
): number {
  if (a.score !== b.score) {
    return a.score - b.score;
  }

  // N.B.: the indices into `.item` are based on the `keys` option specified
  // when constructing the Fuse object.

  const aCity = a.item[1] as unknown as
    | {
        v: string;
      }
    | undefined;
  const bCity = b.item[1] as unknown as
    | {
        v: string;
      }
    | undefined;
  if (aCity && bCity) {
    return aCity.v.localeCompare(bCity.v);
  } else if (aCity && !bCity) {
    // `a` is a company/landmark/viewpoint/ferry/train/dealer
    // `b` is a city/scenery
    return 1;
  } else if (!aCity && bCity) {
    // `a` is a city/scenery
    // `b` is a company/landmark/viewpoint/ferry/train/dealer
    return -1;
  }

  const aTags = a.item[4];
  const bTags = b.item[4];
  if (!Array.isArray(aTags) || !Array.isArray(bTags)) {
    throw new Error('unexpected non-arrays at key 5');
  }

  const aType = assertExists(
    (aTags as unknown as { v: string; i: number }[]).find(t => t.i === 0),
  ).v as SearchProperties['type'];
  const bType = assertExists(
    (bTags as unknown as { v: string; i: number }[]).find(t => t.i === 0),
  ).v as SearchProperties['type'];
  if (aType !== bType) {
    return searchPropertyPriority[aType] - searchPropertyPriority[bType];
  }

  const aLabel = a.item[0] as unknown as { v: string };
  const bLabel = b.item[0] as unknown as { v: string };
  return aLabel.v.localeCompare(bLabel.v);
}
