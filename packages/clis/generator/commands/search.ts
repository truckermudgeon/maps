import { assert, assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import { putIfAbsent } from '@truckermudgeon/base/map';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { getBranchSuffix, toDealerLabel } from '@truckermudgeon/map/labels';
import { PointRBush } from '@truckermudgeon/map/point-rbush';
import { fromWgs84ToAtsCoords } from '@truckermudgeon/map/projections';
import type {
  City,
  Country,
  Node,
  Poi,
  SearchCityProperties,
  SearchPoiProperties,
  SearchProperties,
} from '@truckermudgeon/map/types';
import { featureCollection, point } from '@turf/helpers';
import { quadtree } from 'd3-quadtree';
import fs from 'fs';
import type { GeoJSON } from 'geojson';
import path from 'path';
import type { BBox } from 'rbush';
import RBush from 'rbush';
import type { Argv, BuilderArguments } from 'yargs';
import type { DlcGuardQuadTree } from '../dlc-guards';
import { dlcGuardMapDataKeys, normalizeDlcGuards } from '../dlc-guards';
import { createNormalizeFeature } from '../geo-json/normalize';
import { ets2IsoA2, isoA2Ets2 } from '../geo-json/populated-places';
import { logger } from '../logger';
import type { MappedDataForKeys } from '../mapped-data';
import { readMapData } from '../mapped-data';
import { writeGeojsonFile } from '../write-geojson-file';
import { parseEts2VillagesCsv } from './ets2-villages';
import { maybeEnsureOutputDir, untildify } from './path-helpers';

export const command = 'search';
export const describe =
  'Generates {ats,ets2}-search.geojson from map-parser JSON files';

export const builder = (yargs: Argv) =>
  yargs
    .option('map', {
      alias: 'm',
      // TODO make this work like footprints and contours and accept multiple
      //  source map options.
      describe: 'Source map. Can only specify one.',
      choices: ['usa', 'europe'] as const,
      default: 'usa' as 'usa' | 'europe',
      defaultDescription: 'usa',
    })
    .option('inputDir', {
      alias: 'i',
      describe: 'Path to dir containing parser-generated JSON files',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('extraLabels', {
      alias: 'x',
      describe:
        'Path to extra-labels.geojson file (required for usa, ignored for europe)',
      type: 'string',
      coerce: untildify,
      demandOption: false,
    })
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir {ats,ets2}-search.geojson should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .check(maybeEnsureOutputDir)
    .check(argv => {
      if (Array.isArray(argv.map)) {
        throw new Error('Only one "map" option can be specified.');
      }
      if (argv.map === 'usa' && argv.extraLabels == null) {
        throw new Error('--extraLabels must be specified for usa map');
      }
      return true;
    });

const searchMapDataKeys = [
  ...dlcGuardMapDataKeys,
  'nodes',
  'pois',
  'cities',
  'countries',
] as const;

type SearchFeature<T extends SearchProperties> = GeoJSON.Feature<
  GeoJSON.Point,
  T
>;
type ExtraLabelsGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    text: string;
    country: string;
    kind?: string;
    show?: boolean;
  }
>;

export function handler(args: BuilderArguments<typeof builder>) {
  logger.log('creating search.geojson...');

  const tsMapData = normalizeDlcGuards(
    readMapData(args.inputDir, args.map, {
      mapDataKeys: searchMapDataKeys,
    }),
  );

  let dlcGuardQuadTree: DlcGuardQuadTree;
  if (args.map === 'usa') {
    dlcGuardQuadTree = assertExists(tsMapData.dlcGuardQuadTree);
  } else if (args.map === 'europe') {
    // HACK until europe is properly supported in dlc-guard normalization.
    dlcGuardQuadTree = quadtree<{
      x: number;
      y: number;
      dlcGuard: number;
    }>()
      .x(e => e.x)
      .y(e => e.y);
    // N.B.: this datum must be added separately: it cannot be added as part of
    // the ctor call :(
    dlcGuardQuadTree.add({
      x: 0,
      y: 0,
      dlcGuard: 0,
    });
  } else {
    throw new UnreachableError(args.map);
  }

  let sceneryTowns: ExtraLabelsGeoJSON;
  switch (args.map) {
    case 'usa':
      sceneryTowns = JSON.parse(
        fs.readFileSync(assertExists(args.extraLabels), 'utf-8'),
      ) as unknown as ExtraLabelsGeoJSON;
      sceneryTowns.features = sceneryTowns.features
        .filter(
          ({ properties: { show, kind, text } }) =>
            (kind == null && show == null) ||
            ((kind == 'town' || kind == null) &&
              show === true &&
              text !== 'Golden Gate Bridge'),
        )
        .map(f => {
          f.geometry.coordinates = fromWgs84ToAtsCoords(
            f.geometry.coordinates as [number, number],
          );
          return f;
        });
      break;
    case 'europe': {
      const { villages } = parseEts2VillagesCsv();
      sceneryTowns = featureCollection(
        villages.map(v =>
          point([v.x, v.y], {
            text: v.name,
            country: isoA2Ets2.get(v.state) ?? v.state,
          }),
        ),
      );
      break;
    }
    default:
      throw new UnreachableError(args.map);
  }

  const context = {
    ...tsMapData,
    ...createSpatialIndices(tsMapData, sceneryTowns),
    dlcGuardQuadTree,
  };

  const pois = disambiguateCompanies(tsMapData.pois).flatMap(p =>
    poiToSearchFeature(p, context),
  );

  const cities = [...tsMapData.cities.values()].map(city =>
    cityToSearchFeature(city, context),
  );

  const scenery = sceneryTowns.features.map(f => {
    let state;
    if (args.map === 'usa') {
      const [country, stateCode] = f.properties.country.split('-');
      if (country !== 'US') {
        throw new Error();
      }
      state = assertExists(
        tsMapData.countries.values().find(c => c.code === stateCode),
      );
    } else {
      state = assertExists(
        tsMapData.countries.values().find(c => c.code === f.properties.country),
        'unknown country code: ' + f.properties.country,
      );
    }
    return point(f.geometry.coordinates, {
      dlcGuard: assertExists(
        context.dlcGuardQuadTree.find(
          f.geometry.coordinates[0],
          f.geometry.coordinates[1],
        ),
      ).dlcGuard,
      stateName: state.name,
      stateCode: state.code,
      label: f.properties.text,
      tags: ['scenery'],
      type: 'scenery',
    });
  });

  const normalizeCoords = createNormalizeFeature(args.map, 4);
  writeGeojsonFile(
    path.join(
      args.outputDir,
      `${args.map === 'usa' ? 'ats' : 'ets2'}-search.geojson`,
    ),
    featureCollection(
      ([...pois, ...cities, ...scenery] as SearchFeature<SearchProperties>[])
        .map(normalizeCoords)
        .map(f => {
          if (args.map === 'europe') {
            f.properties.stateCode =
              ets2IsoA2.get(f.properties.stateCode) ?? f.properties.stateCode;
            if ('city' in f.properties) {
              f.properties.city.stateCode =
                ets2IsoA2.get(f.properties.city.stateCode) ??
                f.properties.city.stateCode;
            }
          }
          return f;
        }),
    ),
  );
  logger.success('done.');
}

function createSpatialIndices(
  tsMapData: MappedDataForKeys<['cities', 'countries', 'nodes']>,
  sceneryTowns: ExtraLabelsGeoJSON,
): {
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
  nodePointRTree: PointRBush<{
    x: number;
    y: number;
    node: Node;
  }>;
} {
  const cityRTree = new RBush<
    BBox & {
      cityName: string;
      stateCode: string;
    }
  >();
  cityRTree.load(
    [...tsMapData.cities.values()].flatMap(city =>
      city.areas.map(area => {
        const buffer = 100;
        return {
          minX: area.x - buffer,
          minY: area.y - buffer,
          maxX: area.x + area.width + buffer,
          maxY: area.y + area.height + buffer,
          cityName: city.name,
          stateCode: assertExists(tsMapData.countries.get(city.countryToken))
            .code,
        };
      }),
    ),
  );
  const cityPointRTree = new PointRBush<{
    x: number;
    y: number;
    cityName: string;
    stateCode: string;
  }>();
  cityPointRTree.load(
    [...tsMapData.cities.values()]
      .flatMap(city =>
        city.areas.map(area => ({
          x: area.x + area.width / 2,
          y: area.y + area.height / 2,
          cityName: city.name,
          stateCode: assertExists(tsMapData.countries.get(city.countryToken))
            .code,
        })),
      )
      .concat(
        sceneryTowns.features.map(f => {
          let stateCode: string;
          if (tsMapData.map === 'usa') {
            const [country, state] = f.properties.country.split('-');
            if (country !== 'US') {
              throw new Error();
            }
            stateCode = state;
          } else {
            stateCode = f.properties.country;
          }
          return {
            x: f.geometry.coordinates[0],
            y: f.geometry.coordinates[1],
            cityName: f.properties.text,
            stateCode,
          };
        }),
      ),
  );
  const nodePointRTree = new PointRBush<{ x: number; y: number; node: Node }>();
  nodePointRTree.load(
    [...tsMapData.nodes.values()]
      .filter(
        n =>
          n.forwardCountryId !== 0 &&
          n.forwardCountryId === n.backwardCountryId,
      )
      .map(node => ({
        x: node.x,
        y: node.y,
        node,
      })),
  );

  return {
    cityRTree,
    cityPointRTree,
    nodePointRTree,
  };
}

function disambiguateCompanies(pois: readonly Poi[]): Poi[] {
  const { companies = [], nonCompanies = [] } = Object.groupBy(pois, poi =>
    poi.type === 'company' ? 'companies' : 'nonCompanies',
  );
  const res: Poi[] = nonCompanies;

  const cityTokenToNameToCompany = new Map<
    // city token
    string,
    // company name
    Map<string, (Poi & { type: 'company' })[]>
  >();
  for (const c of companies) {
    if (c.type !== 'company') {
      throw new Error();
    }
    putIfAbsent(
      c.label,
      [],
      putIfAbsent(
        c.cityToken,
        new Map<string, (Poi & { type: 'company' })[]>(),
        cityTokenToNameToCompany,
      ),
    ).push(c);
  }

  const unknownBranches = new Set<string>();
  for (const [, companies] of cityTokenToNameToCompany) {
    for (const [, arr] of companies) {
      if (arr.length <= 1) {
        res.push(...arr);
        continue;
      }
      res.push(
        ...arr.map(poi => {
          const suffix = getBranchSuffix(poi.icon);
          if (!suffix) {
            if (!unknownBranches.has(poi.icon)) {
              logger.warn('unknown branch', poi.icon);
            }
            unknownBranches.add(poi.icon);
          }
          return {
            ...poi,
            label: `${poi.label}${suffix ? ` (${suffix})` : ''}`,
          };
        }),
      );
    }
  }

  return res;
}

function poiToSearchFeature(
  poi: Poi,
  context: MappedDataForKeys<typeof searchMapDataKeys> & {
    dlcGuardQuadTree: DlcGuardQuadTree;
    cityRTree: RBush<BBox & { cityName: string; stateCode: string }>;
    cityPointRTree: PointRBush<{
      x: number;
      y: number;
      cityName: string;
      stateCode: string;
    }>;
    nodePointRTree: PointRBush<{ x: number; y: number; node: Node }>;
  },
): SearchFeature<SearchPoiProperties>[] {
  const { dlcGuardQuadTree, nodePointRTree, cityPointRTree, cityRTree } =
    context;
  const getDlcGuard = (p: { x: number; y: number }): number =>
    assertExists(dlcGuardQuadTree.find(p.x, p.y)).dlcGuard;

  const closestNode = nodePointRTree.findClosest(poi.x, poi.y).node;
  const countriesById = new Map<number, Country>(
    context.countries.values().map(c => [c.id, c]),
  );
  const country =
    countriesById.get(closestNode.forwardCountryId) ??
    countriesById.get(closestNode.backwardCountryId);
  if (!country) {
    if (closestNode.forwardCountryId === closestNode.backwardCountryId) {
      logger.warn(
        'unknown country id',
        closestNode.forwardCountryId,
        'for',
        poi.type,
        poi.icon,
      );
    } else {
      logger.warn(
        'unknown country ids',
        [closestNode.forwardCountryId, closestNode.backwardCountryId],
        'for',
        poi.type,
        poi.icon,
      );
    }
    return [];
  }

  const containingCity = cityRTree
    .search({
      minX: poi.x,
      minY: poi.y,
      maxX: poi.x,
      maxY: poi.y,
    })
    .find(c => c.stateCode === country.code);
  const nearestCity = cityPointRTree.findClosest(poi.x, poi.y, {
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
        distance: distance(nearestCity, poi),
      };

  const baseProperties = {
    dlcGuard: getDlcGuard(poi),
    stateName: country.name,
    stateCode: country.code,
    city,
  };

  let properties: SearchProperties;
  switch (poi.type) {
    case 'company': {
      const city = context.cities.get(poi.cityToken);
      if (!city) {
        logger.warn(
          'ignoring company',
          poi.label,
          'in unknown city:',
          poi.cityToken,
        );
        return [];
      }

      const state = assertExists(context.countries.get(city.countryToken));
      properties = {
        ...baseProperties,
        city: {
          name: city.name,
          stateCode: state.code,
          distance: 0,
        },
        type: 'company',
        label: poi.label,
        sprite: poi.icon,
        tags: ['company'],
      };
      break;
    }
    case 'viewpoint':
      properties = {
        ...baseProperties,
        type: 'viewpoint',
        label: poi.label.replace(/^The /i, ''),
        sprite: poi.icon,
        tags: ['viewpoint'],
      };
      break;
    case 'ferry':
      properties = {
        ...baseProperties,
        type: 'ferry',
        label: poi.label,
        sprite: poi.icon,
        // TODO add tags for cities being connected?
        tags: ['ferry'],
      };
      break;
    case 'train':
      properties = {
        ...baseProperties,
        type: 'train',
        label: poi.label,
        sprite: poi.icon,
        // TODO add tags for cities being connected?
        tags: ['ferry'],
      };
      break;
    case 'landmark':
      properties = {
        ...baseProperties,
        type: 'landmark',
        label: poi.label.replace(/^The /i, ''),
        sprite: poi.icon,
        tags: ['landmark', 'photo', 'trophy'],
      };
      break;
    case 'facility':
      if (poi.icon !== 'dealer_ico') {
        return [];
      }
      properties = {
        ...baseProperties,
        type: 'dealer',
        label: toDealerLabel(poi.prefabPath),
        sprite: 'dealer_ico',
        tags: ['truck', 'dealer'],
      };
      break;
    case 'road':
      return [];
    default:
      throw new UnreachableError(poi);
  }

  // sanity check. this should be ensured by `search` filtering and
  // `findClosest`'s predicate.
  assert(city.stateCode === baseProperties.stateCode);

  return [point([poi.x, poi.y], properties)];
}

function cityToSearchFeature(
  city: City,
  context: MappedDataForKeys<typeof searchMapDataKeys> & {
    dlcGuardQuadTree: DlcGuardQuadTree;
  },
): SearchFeature<SearchCityProperties> {
  const { dlcGuardQuadTree } = context;
  const cityArea = assertExists(city.areas.find(a => !a.hidden));
  const coordinates = [
    city.x + cityArea.width / 2,
    city.y + cityArea.height / 2,
  ];
  const { dlcGuard } = assertExists(
    dlcGuardQuadTree.find(coordinates[0], coordinates[1]),
  );
  const country = assertExists(context.countries.get(city.countryToken));

  return point(coordinates, {
    type: 'city',
    dlcGuard,
    stateName: country.name,
    stateCode: country.code,
    label: city.name,
    tags: ['city'],
  });
}
