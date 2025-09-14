import { assertExists } from '@truckermudgeon/base/assert';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { toDealerLabel } from '@truckermudgeon/map/labels';
import { fromWgs84ToAtsCoords } from '@truckermudgeon/map/projections';
import type {
  City,
  Country,
  Node,
  Poi,
  SearchProperties,
} from '@truckermudgeon/map/types';
import { featureCollection, point } from '@turf/helpers';
import type { Quadtree } from 'd3-quadtree';
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

type SearchFeature = GeoJSON.Feature<GeoJSON.Point, SearchProperties>;
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

  const pois: SearchFeature[] = tsMapData.pois.flatMap(p =>
    poiToSearchFeature(p, context),
  );
  const cities: SearchFeature[] = [...tsMapData.cities.values()].map(city =>
    cityToSearchFeature(city, context),
  );
  const scenery: SearchFeature[] = sceneryTowns.features.map(f => {
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
      [...pois, ...cities, ...scenery].map(normalizeCoords).map(f => {
        if (args.map === 'europe') {
          f.properties.stateCode =
            ets2IsoA2.get(f.properties.stateCode) ?? f.properties.stateCode;
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
  cityQuadTree: Quadtree<{
    x: number;
    y: number;
    cityName: string;
    stateCode: string;
  }>;
  nodeQuadTree: Quadtree<{
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
  const cityQuadTree = quadtree<{
    x: number;
    y: number;
    cityName: string;
    stateCode: string;
  }>()
    .x(e => e.x)
    .y(e => e.y);
  cityQuadTree.addAll(
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
  const nodeQuadTree = quadtree<{ x: number; y: number; node: Node }>()
    .x(e => e.x)
    .y(e => e.y);
  nodeQuadTree.addAll(
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
    cityQuadTree,
    nodeQuadTree,
  };
}

function poiToSearchFeature(
  poi: Poi,
  context: MappedDataForKeys<typeof searchMapDataKeys> & {
    dlcGuardQuadTree: DlcGuardQuadTree;
    cityRTree: RBush<BBox & { cityName: string; stateCode: string }>;
    cityQuadTree: Quadtree<{
      x: number;
      y: number;
      cityName: string;
      stateCode: string;
    }>;
    nodeQuadTree: Quadtree<{ x: number; y: number; node: Node }>;
  },
): SearchFeature[] {
  const { dlcGuardQuadTree, nodeQuadTree, cityQuadTree, cityRTree } = context;
  const getDlcGuard = (p: { x: number; y: number }): number =>
    assertExists(dlcGuardQuadTree.find(p.x, p.y)).dlcGuard;

  const closestNode = assertExists(nodeQuadTree.find(poi.x, poi.y)).node;
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
        poi,
      );
    } else {
      logger.warn(
        'unknown country ids',
        [closestNode.forwardCountryId, closestNode.backwardCountryId],
        'for',
        poi,
      );
    }
    return [];
  }

  const baseProperties = {
    dlcGuard: getDlcGuard(poi),
    stateName: country.name,
    stateCode: country.code,
  };

  const containingCity = cityRTree
    .search({
      minX: poi.x,
      minY: poi.y,
      maxX: poi.x,
      maxY: poi.y,
    })
    // use `.at(0)` instead of `[0]` to force inferred type of `containingCity`
    // to be `| undefined`.
    .at(0);
  const nearestCity = assertExists(cityQuadTree.find(poi.x, poi.y));
  const cityProperties: { containingCity?: string; nearestCity?: string } = {
    containingCity: containingCity?.cityName,
    nearestCity: nearestCity.cityName,
  };
  if (cityProperties.containingCity) {
    delete cityProperties.nearestCity;
  }
  const city = containingCity ?? nearestCity;

  let properties: SearchProperties;
  switch (poi.type) {
    case 'company':
      properties = {
        ...baseProperties,
        ...cityProperties,
        type: 'company',
        label: poi.label,
        sprite: poi.icon,
        tags: ['company'],
      };
      break;
    case 'viewpoint':
      properties = {
        ...baseProperties,
        ...cityProperties,
        type: 'viewpoint',
        label: poi.label.replace(/^The /i, ''),
        sprite: poi.icon,
        tags: ['viewpoint'],
      };
      break;
    case 'ferry':
      properties = {
        ...baseProperties,
        ...cityProperties,
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
        ...cityProperties,
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
        ...cityProperties,
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
        ...cityProperties,
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

  if (city.stateCode !== baseProperties.stateCode) {
    switch (properties.label) {
      case 'El Capitan':
        properties.nearestCity = 'Texas-Utah border';
        break;
      case 'Monument Valley':
        properties.nearestCity = 'Mexican Hat';
        break;
      case 'Four Corners Monument':
        properties.nearestCity = 'Teec Nos Pos';
        break;
      case 'Mesocco Castle':
        properties.nearestCity = 'San Bernardino';
        break;
      case 'Chillon Castle':
        properties.nearestCity = 'Vevey';
        break;
      case 'Karawanks Tunnel':
        properties.nearestCity = 'Austria-Slovenia border';
        break;
      case 'New Europe Bridge':
        properties.nearestCity = 'Romania-Bulgaria border';
        break;
      case 'Pelješac Bridge':
        properties.nearestCity = 'Croatia-Bosnia and Herzegovina border';
        break;
      case 'Ivangorod Fortress and Hermann Castle':
        properties.nearestCity = 'Russia-Estonia border';
        break;
      case 'Guadiana International Bridge':
        properties.nearestCity = 'Portugal-Spain border';
        break;
      default:
        logger.error(
          'mismatched state code for',
          properties.label,
          `(guessed: ${city.stateCode}; actual: ${baseProperties.stateCode}).`,
        );
        throw new Error();
    }
    logger.warn(
      'mismatched state code for',
      properties.label,
      `(guessed: ${city.stateCode}; actual: ${baseProperties.stateCode}).`,
      `Using "${properties.nearestCity}"`,
      'as nearest city.',
    );
  }

  return [point([poi.x, poi.y], properties)];
}

function cityToSearchFeature(
  city: City,
  context: MappedDataForKeys<typeof searchMapDataKeys> & {
    dlcGuardQuadTree: DlcGuardQuadTree;
  },
): SearchFeature {
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
