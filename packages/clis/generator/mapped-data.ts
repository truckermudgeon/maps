import { distance } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type {
  Building,
  City,
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
} from '@truckermudgeon/parser';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { logger } from './logger';
import { fromAtsCoordsToWgs84, fromEts2CoordsToWgs84 } from './projections';
import { readArrayFile } from './read-array-file';

const MapDataKeys: Record<keyof MapData, void> = {
  cities: undefined,
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

  const cities = readArrayFile<City>(toJsonFilePath('cities.json'));
  let focusCoords: [number, number] | undefined;
  if (focusOptions) {
    switch (focusOptions.type) {
      case 'city': {
        const maybeCity = cities.find(
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

  const focus =
    focusCoords != null
      ? (i: { x: number; y: number }) =>
          distance([i.x, i.y], focusCoords!) <= focusOptions!.radiusMeters
      : () => true;
  const focusXY = ({ x, y }: { x: number; y: number }) => focus({ x, y });
  // A node for an item can be further away from that item. Define a focus
  // function that can be used for nodes, which has a 100m-padding search
  // radius, so that we can avoid writing referenced node logic.
  const focusXYPlus =
    (radius: number) =>
    ({ x, y }: { x: number; y: number }) =>
      focus({ x: x + radius, y: y + radius });

  logger.log('reading ats-map JSON files...');
  const countries = readArrayFile<Country>(toJsonFilePath('countries.json'));
  const nodes = readArrayFile<Node>(toJsonFilePath('nodes.json'));
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

  const mapped = {
    nodes: mapify(nodes, n => String(n.uid)),
    roads: mapify(roads, r => String(r.uid)),
    ferries: mapify(ferries, f => f.token),
    prefabs: mapify(prefabs, p => String(p.uid)),
    models: mapify(models, p => String(p.uid)),
    dividers: mapify(dividers, d => String(d.uid)),
    mapAreas: mapify(mapAreas, a => String(a.uid)),
    countries: mapify(countries, c => c.token),
    cities: mapify(cities, c => c.token),
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
      '\nre-export JSON files using map-parser and try again.',
    );
    process.exit(1);
  }
}
