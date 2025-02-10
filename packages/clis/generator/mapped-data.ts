import { assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type {
  Achievement,
  Building,
  City,
  Company,
  CompanyItem,
  Country,
  Curve,
  Cutscene,
  Ferry,
  MapArea,
  MapData,
  MileageTarget,
  Model,
  Node,
  Poi,
  Prefab,
  PrefabDescription,
  Road,
  RoadLook,
  Route,
  TrajectoryItem,
  Trigger,
  WithToken,
} from '@truckermudgeon/map/types';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { logger } from './logger';
import { readArrayFile } from './read-array-file';

const mapDataKeys: Record<keyof MapData, void> = {
  achievements: undefined,
  cities: undefined,
  companies: undefined,
  companyDefs: undefined,
  countries: undefined,
  dividers: undefined,
  ferries: undefined,
  mapAreas: undefined,
  mileageTargets: undefined,
  modelDescriptions: undefined,
  models: undefined,
  nodes: undefined,
  elevation: undefined,
  pois: undefined,
  prefabDescriptions: undefined,
  prefabs: undefined,
  roadLooks: undefined,
  roads: undefined,
  trajectories: undefined,
  triggers: undefined,
  cutscenes: undefined,
  routes: undefined,
};
const allMapDataKeys = Object.freeze(Object.keys(mapDataKeys));
export type MapDataKeys = (keyof typeof mapDataKeys)[];

type PickKey<
  T extends keyof MapData,
  U extends keyof MapData[T][0],
> = MapData[T][0][U];

interface MapDataKeyFields {
  achievements: PickKey<'achievements', 'token'>;
  cities: PickKey<'cities', 'token'>;
  companies: PickKey<'companies', 'uid'>;
  companyDefs: PickKey<'companyDefs', 'token'>;
  countries: PickKey<'countries', 'token'>;
  cutscenes: PickKey<'cutscenes', 'uid'>;
  dividers: PickKey<'dividers', 'uid'>;
  elevation: PickKey<'elevation', never>;
  ferries: PickKey<'ferries', 'token'>;
  mapAreas: PickKey<'mapAreas', 'uid'>;
  mileageTargets: PickKey<'mileageTargets', 'token'>;
  modelDescriptions: PickKey<'modelDescriptions', 'token'>;
  models: PickKey<'models', 'uid'>;
  nodes: PickKey<'nodes', 'uid'>;
  pois: PickKey<'pois', never>;
  prefabDescriptions: PickKey<'prefabDescriptions', 'token'>;
  prefabs: PickKey<'prefabs', 'uid'>;
  roadLooks: PickKey<'roadLooks', 'token'>;
  roads: PickKey<'roads', 'uid'>;
  routes: PickKey<'routes', 'token'>;
  trajectories: PickKey<'trajectories', 'uid'>;
  triggers: PickKey<'triggers', 'uid'>;
}

// Transforms MapData (a type containing all array properties) into a type with
// all Map<string|bigint, ...> properties, _except_ for `pois` and `elevation`
// (which are left alone as arrays).
export type MappedData<T extends 'usa' | 'europe' = 'usa' | 'europe'> = {
  map: T;
} & Omit<
  {
    [K in keyof MapData]: ReadonlyMap<MapDataKeyFields[K], MapData[K][0]>;
  },
  'pois' | 'elevation'
> & {
    pois: Readonly<MapData['pois']>;
    elevation: Readonly<MapData['elevation']>;
  };

export type MappedDataForKeys<T extends readonly (keyof MapData)[]> = Pick<
  MappedData,
  'map' | T[number]
>;

export type FocusOptions = { radiusMeters: number } & (
  | {
      type: 'city';
      city: string;
    }
  | {
      type: 'coords';
      coords: [number, number];
    }
);

interface Options<K extends keyof MapData> {
  mapDataKeys: readonly K[];
  includeHidden: boolean;
  focus?: FocusOptions;
}

export function readMapData<
  T extends 'usa' | 'europe',
  K extends keyof MapData,
>(
  inputDir: string,
  map: T,
  options: Options<K>,
): Pick<MappedData<T>, 'map' | K> {
  checkJsonFilesPresent(inputDir, map);
  const toJsonFilePath = (key: string) =>
    path.join(inputDir, map + '-' + key + '.json');
  const { includeHidden, focus: focusOptions } = options;

  const allCities = readArrayFile<City>(toJsonFilePath('cities'));
  let focusCoords: [number, number] | undefined;
  if (focusOptions) {
    switch (focusOptions.type) {
      case 'city': {
        const maybeCity = allCities.find(
          c => c.name.toLowerCase() === focusOptions.city.toLowerCase(),
        );
        if (!maybeCity) {
          logger.error('unknown focus city', focusOptions.city);
          process.exit(2);
        }
        focusCoords = [maybeCity.x, maybeCity.y];
        break;
      }
      case 'coords':
        focusCoords = focusOptions.coords;
        break;
      default:
        throw new UnreachableError(focusOptions);
    }
  }

  const toWgs84 = map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;
  if (focusCoords) {
    logger.info(
      'focusing on',
      focusCoords,
      toWgs84(focusCoords).map(n => Number(n.toFixed(3))),
      `(${focusOptions?.radiusMeters} meters)`,
    );
  }

  const focusXY =
    focusCoords != null
      ? (i: { x: number; y: number }, padding = 0) =>
          distance([i.x, i.y], focusCoords) <=
          focusOptions!.radiusMeters + padding
      : () => true;
  const focusXYArray =
    focusCoords != null
      ? (i: [number, number, number], padding = 0) =>
          distance([i[0], i[1]], focusCoords) <=
          focusOptions!.radiusMeters + padding
      : () => true;
  const focusXYPlus = (padding: number) => (pos: { x: number; y: number }) =>
    focusXY(pos, padding);

  logger.log(`reading ${map} map JSON files...`);
  const cities = allCities.filter(focusXY);
  const cityTokens = new Set(cities.map(c => c.token));
  const countryTokens = new Set(cities.map(c => c.countryToken));

  const mapData: Partial<Omit<MappedData<T>, 'map'>> = {};
  const uniqueKeys = new Set(options.mapDataKeys);
  for (const key of uniqueKeys) {
    switch (key) {
      case 'nodes': {
        mapData.nodes = mapify(
          readArrayFile<Node>(toJsonFilePath(key), focusXYPlus(1000)),
          n => n.uid,
        );
        break;
      }
      case 'roads':
        mapData.roads = mapify(
          readArrayFile<Road>(
            toJsonFilePath(key),
            r => (includeHidden ? true : !r.hidden) && focusXY(r),
          ),
          r => r.uid,
        );
        break;
      case 'ferries':
        mapData.ferries = mapify(
          readArrayFile<Ferry>(toJsonFilePath(key), focusXY),
          f => f.token,
        );
        break;
      case 'prefabs':
        mapData.prefabs = mapify(
          readArrayFile<Prefab>(
            toJsonFilePath(key),
            p => (includeHidden ? true : !p.hidden) && focusXY(p),
          ),
          p => p.uid,
        );
        break;
      case 'companies':
        mapData.companies = mapify(
          readArrayFile<CompanyItem>(toJsonFilePath(key), focusXY),
          c => c.uid,
        );
        break;
      case 'models':
        mapData.models = mapify(
          readArrayFile<Model>(toJsonFilePath(key), focusXY),
          m => m.uid,
        );
        break;
      case 'mapAreas':
        mapData.mapAreas = mapify(
          readArrayFile<MapArea>(toJsonFilePath(key), focusXYPlus(200)),
          m => m.uid,
        );
        break;
      case 'dividers':
        mapData.dividers = mapify(
          readArrayFile<Building | Curve>(toJsonFilePath(key), focusXY),
          d => d.uid,
        );
        break;
      case 'cities':
        mapData.cities = mapify(allCities.filter(focusXY), c => c.token);
        break;
      case 'countries':
        mapData.countries = mapify(
          readArrayFile<Country>(toJsonFilePath(key), country =>
            countryTokens.has(country.token),
          ),
          c => c.token,
        );

        break;
      case 'companyDefs':
        mapData.companyDefs = mapify(
          readArrayFile<WithToken<Company>>(toJsonFilePath(key), company =>
            company.cityTokens.some(token => cityTokens.has(token)),
          ),
          c => c.token,
        );
        break;
      case 'roadLooks':
        mapData.roadLooks = mapify(
          readArrayFile<WithToken<RoadLook>>(toJsonFilePath(key)),
          r => r.token,
        );
        break;
      case 'prefabDescriptions':
        mapData.prefabDescriptions = mapify(
          readArrayFile<WithToken<PrefabDescription>>(toJsonFilePath(key)),
          p => p.token,
        );
        break;
      case 'modelDescriptions':
        break;
      // N.B.: the following data is always included in its entirety, regardless
      // of focus options.
      case 'achievements':
        mapData.achievements = mapify(
          readArrayFile<WithToken<Achievement>>(toJsonFilePath(key)),
          a => a.token,
        );
        break;
      case 'trajectories':
        mapData.trajectories = mapify(
          readArrayFile<TrajectoryItem>(toJsonFilePath(key)),
          t => t.uid,
        );
        break;
      case 'triggers':
        mapData.triggers = mapify(
          readArrayFile<Trigger>(toJsonFilePath(key)),
          t => t.uid,
        );
        break;
      case 'cutscenes':
        mapData.cutscenes = mapify(
          readArrayFile<Cutscene>(toJsonFilePath(key)),
          c => c.uid,
        );
        break;
      case 'routes':
        mapData.routes = mapify(
          readArrayFile<WithToken<Route>>(toJsonFilePath(key)),
          r => r.token,
        );
        break;
      case 'mileageTargets':
        mapData.mileageTargets = mapify(
          readArrayFile<WithToken<MileageTarget>>(toJsonFilePath(key)),
          t => t.token,
        );
        break;
      // N.B.: the following data is always in array form.
      case 'pois':
        mapData.pois = readArrayFile<Poi>(toJsonFilePath(key), focusXY);
        break;
      case 'elevation':
        mapData.elevation = readArrayFile<[number, number, number]>(
          toJsonFilePath(key),
          focusXYArray,
        );
        break;
      default:
        throw new UnreachableError(key);
    }
  }

  // companies may be linked to hidden prefabs or prefabs outside the focused range.
  // filter them out so `companies` array is consistent with prefabs.
  if (
    mapData.companies != null &&
    (mapData.prefabs != null || mapData.nodes != null)
  ) {
    // the following casts are required so we can mutate the maps.
    const companiesMap = mapData.companies as Map<bigint, unknown>;
    const prefabsMap = (mapData.prefabs ?? new Map()) as Map<bigint, unknown>;
    const nodesMap = (mapData.nodes ?? new Map()) as Map<bigint, unknown>;
    for (const company of mapData.companies.values()) {
      const prefabUid = company.prefabUid;
      const nodeUid = company.nodeUid;
      if (!prefabsMap.has(prefabUid)) {
        prefabsMap.delete(prefabUid);
        nodesMap.delete(nodeUid);
        companiesMap.delete(company.uid);
      }
    }
  }

  for (const k of uniqueKeys) {
    // verify `mapData` contains entries for all keys in `options.mapDataKeys`
    const mapOrArray = assertExists(mapData[k]);
    if (Array.isArray(mapOrArray)) {
      logger.info(mapOrArray.length, k);
    } else {
      logger.info((mapOrArray as ReadonlyMap<unknown, unknown>).size, k);
    }
  }
  // this cast should be safe because `mapData` contains all keys K.
  return { ...mapData, map } as Pick<MappedData<T>, 'map' | K>;
}

function mapify<T, U>(arr: T[], k: (t: T) => U): Map<U, T> {
  return new Map(arr.map(item => [k(item), item]));
}

function checkJsonFilesPresent(inputDir: string, map: 'usa' | 'europe') {
  logger.log('checking for required JSON files...');
  const missingJsonFiles = allMapDataKeys.filter(
    fn => !fs.existsSync(path.join(inputDir, map + '-' + fn + '.json')),
  );
  if (missingJsonFiles.length) {
    logger.error(
      'missing JSON files in directory',
      inputDir,
      '\n  ',
      missingJsonFiles.map(f => `${f}.json`).join(', '),
      '\nre-export JSON files using parser and try again.',
    );
    process.exit(1);
  }
}
