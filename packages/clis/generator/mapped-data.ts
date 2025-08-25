import { assert, assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
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
  ModelDescription,
  Node,
  Poi,
  Prefab,
  PrefabDescription,
  Road,
  RoadLook,
  Route,
  Sign,
  SignDescription,
  TrajectoryItem,
  Trigger,
  WithPath,
  WithToken,
} from '@truckermudgeon/map/types';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { logger } from './logger';

export type MapDataKeys = (keyof MapData)[];

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
  signDescriptions: PickKey<'signDescriptions', 'token'>;
  signs: PickKey<'signs', 'uid'>;
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
  /**
   * if `true`, then the `roads` and `prefabs` maps returned will include
   * entries for roads/prefabs that are hidden-from-the-game's-ui-map (i.e.,
   * unreachable).
   *
   * This option is only meaningful if `mapDataKeys` includes `'roads'` and/or
   * `'prefabs'`.
   */
  includeHiddenRoadsAndPrefabs?: boolean;
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
  Preconditions.checkArgument(options.mapDataKeys.length > 0);
  checkJsonFilesPresent(inputDir, map, new Set(options.mapDataKeys));
  const toJsonFilePath = (key: string) =>
    path.join(inputDir, map + '-' + key + '.json');
  const { includeHiddenRoadsAndPrefabs = false, focus: focusOptions } = options;

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
      ? (i: { x: number; y: number }) =>
          distance([i.x, i.y], focusCoords) <= focusOptions!.radiusMeters
      : () => true;
  const focusXYArray =
    focusCoords != null
      ? (i: [number, number, number]) =>
          distance([i[0], i[1]], focusCoords) <= focusOptions!.radiusMeters
      : () => true;
  const focusXYPlus = (padding: number) =>
    focusCoords != null
      ? (i: { x: number; y: number }) =>
          distance([i.x, i.y], focusCoords) <=
          focusOptions!.radiusMeters + padding
      : () => true;

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
            r =>
              (includeHiddenRoadsAndPrefabs ? true : !r.hidden) && focusXY(r),
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
            p =>
              (includeHiddenRoadsAndPrefabs ? true : !p.hidden) && focusXY(p),
          ),
          p => p.uid,
        );
        break;
      case 'signs':
        mapData.signs = mapify(
          readArrayFile<Sign>(toJsonFilePath(key), focusXY),
          t => t.uid,
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
          readArrayFile<WithToken<WithPath<PrefabDescription>>>(
            toJsonFilePath(key),
          ),
          p => p.token,
        );
        break;
      case 'modelDescriptions':
        mapData.modelDescriptions = mapify(
          readArrayFile<WithToken<ModelDescription>>(toJsonFilePath(key)),
          m => m.token,
        );
        break;
      case 'signDescriptions':
        mapData.signDescriptions = mapify(
          readArrayFile<WithToken<SignDescription>>(toJsonFilePath(key)),
          m => m.token,
        );
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

function checkJsonFilesPresent(
  inputDir: string,
  map: string,
  keys: Set<string>,
) {
  const missingJsonFiles = [...keys].filter(
    fn => !fs.existsSync(path.join(inputDir, map + '-' + fn + '.json')),
  );
  if (missingJsonFiles.length) {
    logger.error(
      'missing JSON files in directory',
      inputDir,
      '\n\n  ',
      missingJsonFiles.map(f => `${map}-${f}.json`).join(', '),
      '\n\nre-export JSON files using parser and try again.',
    );
    process.exit(1);
  }
}

/**
 * Reads the contents of a serialized JSON array. Transforms:
 * - string properties named `uid` or ending in `Uid` into bigints
 * - string array properties with key name ending in `Uids` into bigint arrays
 */
function readArrayFile<T>(filepath: string, filter?: (t: T) => boolean): T[] {
  const basename = path.basename(filepath, '.json');
  const start = Date.now();
  const reviver =
    basename.endsWith('elevation') ||
    basename.endsWith('prefabDescriptions') ||
    basename.endsWith('nodes')
      ? undefined
      : bigintReviver;
  const results: unknown = JSON.parse(
    fs.readFileSync(filepath, 'utf-8'),
    reviver,
  );
  if (!Array.isArray(results)) {
    throw new Error();
  }
  const filtered = filter ? (results as T[]).filter(filter) : (results as T[]);
  if (basename.endsWith('nodes')) {
    for (const t of filtered) {
      const node = t as { -readonly [K in keyof Node]: Node[K] };
      node.uid = BigInt('0x' + node.uid);
      node.forwardItemUid = BigInt('0x' + node.forwardItemUid);
      node.backwardItemUid = BigInt('0x' + node.backwardItemUid);
    }
  }
  logger.debug((Date.now() - start) / 1000, 'seconds:', basename);
  return filtered;
}

function bigintReviver(key: string, value: unknown): unknown {
  if (key === 'uid' || key.endsWith('Uid')) {
    return toBigInt(value);
  } else if (key.endsWith('Uids')) {
    assert(Array.isArray(value));
    return (value as unknown[]).map(toBigInt);
  }
  return value;
}

function toBigInt(v: unknown): bigint {
  assert(typeof v === 'string' && /^[0-9a-f]+$/.test(v));
  return BigInt('0x' + (v as string));
}
