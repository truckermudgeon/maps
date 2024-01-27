import { distance } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type {
  Building,
  City,
  Company,
  CompanyItem,
  Country,
  Curve,
  Ferry,
  MapArea,
  MapData,
  Model,
  ModelDescription,
  Node,
  Poi,
  Prefab,
  PrefabDescription,
  Road,
  RoadLook,
  WithToken,
} from '@truckermudgeon/map/types';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { logger } from './logger';
import { readArrayFile } from './read-array-file';

const MapDataKeys: Record<keyof MapData, void> = {
  cities: undefined,
  companies: undefined,
  companyDefs: undefined,
  countries: undefined,
  dividers: undefined,
  ferries: undefined,
  mapAreas: undefined,
  modelDescriptions: undefined,
  models: undefined,
  nodes: undefined,
  pois: undefined,
  prefabDescriptions: undefined,
  prefabs: undefined,
  roadLooks: undefined,
  roads: undefined,
};
const mapJsonFiles = Object.freeze(Object.keys(MapDataKeys));

// Transforms MapData (a type containing all array properties) into a type with
// all Map<string, ...> properties, _except_ for `pois` (which is left alone as
// an array).
export type MappedData = Omit<
  {
    [K in keyof MapData]: Map<string, MapData[K][0]>;
  },
  'pois'
> & {
  pois: MapData['pois'];
};

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

interface Options {
  includeHidden: boolean;
  focus?: FocusOptions;
}

export function readMapData(
  inputDir: string,
  map: 'usa' | 'europe',
  options: Options,
): MappedData {
  checkJsonFilesPresent(inputDir, map);
  const toJsonFilePath = (fn: string) => path.join(inputDir, map + '-' + fn);
  const { includeHidden, focus: focusOptions } = options;

  const allCities = readArrayFile<City>(toJsonFilePath('cities.json'));
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
          distance([i.x, i.y], focusCoords!) <=
          focusOptions!.radiusMeters + padding
      : () => true;
  const focusXYPlus = (padding: number) => (pos: { x: number; y: number }) =>
    focusXY(pos, padding);

  logger.log('reading ats-map JSON files...');
  const cities = allCities.filter(focusXY);
  const cityTokens = new Set(cities.map(c => c.token));
  const countryTokens = new Set(cities.map(c => c.countryToken));
  const companyDefs = readArrayFile<WithToken<Company>>(
    toJsonFilePath('companyDefs.json'),
    company => company.cityTokens.some(token => cityTokens.has(token)),
  );
  const countries = readArrayFile<Country>(
    toJsonFilePath('countries.json'),
    country => countryTokens.has(country.token),
  );
  const nodes = readArrayFile<Node>(
    toJsonFilePath('nodes.json'),
    focusXYPlus(1000),
  );
  const roads = readArrayFile<Road>(
    toJsonFilePath('roads.json'),
    r => (includeHidden ? true : !r.hidden) && focusXY(r),
  );
  const ferries = readArrayFile<Ferry>(toJsonFilePath('ferries.json'), focusXY);
  const prefabs = readArrayFile<Prefab>(
    toJsonFilePath('prefabs.json'),
    p => (includeHidden ? true : !p.hidden) && focusXY(p),
  );
  const models = readArrayFile<Model>(toJsonFilePath('models.json'), focusXY);
  const dividers = readArrayFile<Building | Curve>(
    toJsonFilePath('dividers.json'),
    focusXY,
  );
  const mapAreas = readArrayFile<MapArea>(
    toJsonFilePath('mapAreas.json'),
    focusXYPlus(200),
  );
  const pois = readArrayFile<Poi>(toJsonFilePath('pois.json'), focusXY);
  const roadLooks = readArrayFile<WithToken<RoadLook>>(
    toJsonFilePath('roadLooks.json'),
  );
  const prefabDescriptions = readArrayFile<WithToken<PrefabDescription>>(
    toJsonFilePath('prefabDescriptions.json'),
  );
  const modelDescriptions = readArrayFile<WithToken<ModelDescription>>(
    toJsonFilePath('modelDescriptions.json'),
  );

  const prefabsMap = mapify(prefabs, p => String(p.uid));
  const nodesMap = mapify(nodes, n => String(n.uid));
  // companies may be linked to hidden prefabs or prefabs outside the focused range.
  // filter them out so `companies` array is consistent with prefabs.
  const companies = readArrayFile<CompanyItem>(
    toJsonFilePath('companies.json'),
    company => {
      if (!focusXY(company)) {
        return false;
      }
      const prefabUid = String(company.prefabUid);
      const nodeUid = String(company.nodeUid);
      if (!prefabsMap.has(prefabUid)) {
        // HACK side-effect in a .filter :grimacing:
        prefabsMap.delete(prefabUid);
        nodesMap.delete(nodeUid);
        return false;
      }
      return true;
    },
  );

  const mapped = {
    nodes: nodesMap,
    roads: mapify(roads, r => String(r.uid)),
    ferries: mapify(ferries, f => f.token),
    prefabs: prefabsMap,
    companies: mapify(companies, c => String(c.uid)),
    models: mapify(models, p => String(p.uid)),
    dividers: mapify(dividers, d => String(d.uid)),
    mapAreas: mapify(mapAreas, a => String(a.uid)),
    countries: mapify(countries, c => c.token),
    cities: mapify(cities, c => c.token),
    companyDefs: mapify(companyDefs, c => c.token),
    roadLooks: mapify(roadLooks, r => r.token),
    prefabDescriptions: mapify(prefabDescriptions, p => p.token),
    modelDescriptions: mapify(modelDescriptions, p => p.token),
    pois,
  };
  for (const k of Object.keys(mapped)) {
    const mapOrArray = mapped[k as keyof typeof mapped];
    if (Array.isArray(mapOrArray)) {
      logger.info(mapOrArray.length, k);
    } else {
      logger.info(mapOrArray.size, k);
    }
  }
  return mapped;
}

function mapify<T>(arr: T[], k: (t: T) => string): Map<string, T> {
  return new Map(arr.map(item => [k(item), item]));
}

function checkJsonFilesPresent(inputDir: string, map: 'usa' | 'europe') {
  logger.log('checking for required JSON files...');
  const missingJsonFiles = mapJsonFiles.filter(
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
