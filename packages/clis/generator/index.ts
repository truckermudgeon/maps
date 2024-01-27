#!/usr/bin/env -S npx tsx

import { assertExists } from '@truckermudgeon/base/assert';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type {
  City,
  Country,
  FootprintProperties,
  Model,
  ModelDescription,
  Node,
  Poi,
  ScopedCityFeature,
  ScopedCountryFeature,
} from '@truckermudgeon/map/types';
import { execSync } from 'child_process';
import fs from 'fs';
import type { GeoJSON } from 'geojson';
import * as os from 'os';
import path from 'path';
import * as process from 'process';
import url from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { convertToFootprintsGeoJson, convertToGeoJson } from './geo-json';
import { checkGraph } from './graph/check-graph';
import { toDemoGraph } from './graph/demo-graph';
import { generateGraph } from './graph/graph';
import { logger } from './logger';
import type { FocusOptions } from './mapped-data';
import { readMapData } from './mapped-data';
import { readArrayFile } from './read-array-file';
import { createSpritesheet } from './spritesheet';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const homeDirectory = os.homedir();
const untildify = (path: string) =>
  homeDirectory ? path.replace(/^~(?=$|\/|\\)/, homeDirectory) : path;
const maybeEnsureOutputDir = (args: {
  outputDir: string;
  dryRun?: boolean;
}) => {
  if (!args.dryRun && !fs.existsSync(args.outputDir)) {
    fs.mkdirSync(args.outputDir, { recursive: true });
  }
  return true;
};

function graphCommandBuilder(yargs: yargs.Argv) {
  return yargs
    .option('map', {
      alias: 'm',
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
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir graph.json file should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('check', {
      alias: 'c',
      describe: 'Run a simple validity check on the generated graph',
      type: 'boolean',
      default: false,
    })
    .option('demo', {
      alias: 'd',
      describe: 'Output a graph.json tailored for the demo-app',
      type: 'boolean',
      default: false,
    })
    .option('dryRun', {
      describe: "Don't write out any files.",
      type: 'boolean',
      default: false,
    })
    .check(maybeEnsureOutputDir)
    .check(argv => {
      if (Array.isArray(argv.map)) {
        throw new Error('Only one "map" option can be specified.');
      }
      return true;
    })
    .parse();
}

function mapCommandBuilder(yargs: yargs.Argv) {
  return yargs
    .option('map', {
      alias: 'm',
      describe: 'Source map. Can only specify one.',
      choices: ['usa', 'europe'] as const,
      default: 'usa' as 'usa' | 'europe',
      defaultDescription: 'usa',
    })
    .option('focusCity', {
      alias: 'f',
      describe:
        'City to focus on. Generated files will only contain objects within `focusRadius`.',
      type: 'string',
      conflicts: 'focusGameCoords',
    })
    .option('focusGameCoords', {
      alias: 'c',
      describe:
        'Game coords to focus on, in "x,y" format (e.g., "-35578,20264"). Generated files will only contain objects within `focusRadius`.',
      type: 'string',
      conflicts: 'focusCity',
    })
    .option('focusRadius', {
      alias: 'r',
      describe: 'Distance in meters used to focus output.',
      type: 'number',
      default: 5_000,
    })
    .option('includeHidden', {
      alias: 'h',
      describe: 'Include hidden roads and prefabs in output.',
      type: 'boolean',
      default: false,
    })
    .option('includeDebug', {
      alias: 'd',
      describe: 'Include debugging features in output.',
      type: 'boolean',
      default: false,
    })
    .option('skipCoalescing', {
      describe:
        "Skip coalescing of road features (you probably don't want to do this).",
      type: 'boolean',
      default: false,
    })
    .option('inputDir', {
      alias: 'i',
      describe: 'Path to dir containing parser-generated JSON files',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir output files should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('type', {
      alias: 't',
      describe:
        'Type of files to write.\nSpecify multiple types with multiple -t arguments.',
      choices: ['pmtiles', 'geojson'] as const,
      default: ['pmtiles'] as ('pmtiles' | 'geojson')[],
      defaultDescription: 'pmtiles',
    })
    .option('dryRun', {
      describe: "Don't write out any files.",
      type: 'boolean',
      default: false,
    })
    .option('minAttrs', {
      describe: "Don't write out unused GeoJSON attrs in pmtiles.",
      type: 'boolean',
      default: true,
    })
    .check(maybeEnsureOutputDir)
    .check(argv => {
      if (Array.isArray(argv.map)) {
        throw new Error('Only one "map" option can be specified.');
      }
      return true;
    })
    .parse();
}

function spritesheetCommandBuilder(yargs: yargs.Argv) {
  return yargs
    .option('inputDir', {
      alias: 'i',
      describe:
        'Path to dir containing {usa,europe}-poi.json files and icon directory',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe:
        'Path to dir sprites(@2x).{json,png} files should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .check(maybeEnsureOutputDir)
    .parse();
}

function footprintsCommandBuilder(yargs: yargs.Argv) {
  return yargs
    .option('map', {
      alias: 'm',
      describe:
        'Source map.\nSpecify multiple source maps with multiple -m arguments.',
      choices: ['usa', 'europe'] as const,
      default: ['usa'] as ('usa' | 'europe')[],
      defaultDescription: 'usa',
    })
    .option('inputDir', {
      alias: 'i',
      describe:
        'Path to dir containing {node,model,modelDescription}.json files',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir output GeoJSON should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .check(maybeEnsureOutputDir)
    .parse();
}

function citiesCommandBuilder(yargs: yargs.Argv) {
  return yargs
    .option('map', {
      alias: 'm',
      describe:
        'Source map.\nSpecify multiple source maps with multiple -m arguments.',
      choices: ['usa', 'europe'] as const,
      default: ['usa'] as ('usa' | 'europe')[],
      defaultDescription: 'usa',
    })
    .option('inputDir', {
      alias: 'i',
      describe: 'Path to dir containing source {usa,europe}-cities.json file',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir cities.geojson should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .check(maybeEnsureOutputDir)
    .parse();
}

// eslint-disable-next-line @typescript-eslint/require-await
async function main() {
  yargs(hideBin(process.argv))
    .command(
      'map',
      'Generates {usa,europe}.{geojson,pmtiles} from map-parser JSON files',
      mapCommandBuilder,
      handleMapCommand,
    )
    .command(
      'cities',
      'Generates cities.geojson from map-parser JSON files',
      citiesCommandBuilder,
      handleCitiesCommand,
    )
    .command(
      'footprints',
      'Generates building footprints.geojson from map-parser JSON files',
      footprintsCommandBuilder,
      handleFootprintsCommand,
    )
    .command(
      'spritesheet',
      'Generates maplibre spritesheet files from map-parser JSON and PNG files',
      spritesheetCommandBuilder,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      handleSpritesheetCommand,
    )
    .command(
      'graph',
      'Generates {usa,europe}-graph.json from map-parser JSON files',
      graphCommandBuilder,
      handleGraphCommand,
    )
    .demandCommand()
    .check(argv => {
      if (argv._.length !== 1) {
        throw new Error('Only one command can be given at a time.');
      }
      return true;
    })
    .parse();
}

function handleFootprintsCommand(
  args: ReturnType<typeof footprintsCommandBuilder>,
) {
  const toJsonPath = (map: 'usa' | 'europe', suffix: string) =>
    path.join(args.inputDir, `${map}-${suffix}.json`);

  const footprintFeatures = [args.map].flat().flatMap(map => {
    const nodes = readArrayFile<Node>(toJsonPath(map, 'nodes'));
    const models = readArrayFile<Model>(toJsonPath(map, 'models'));
    const modelDescriptions = readArrayFile<
      ModelDescription & { token: string }
    >(toJsonPath(map, 'modelDescriptions'));
    const geoJson = convertToFootprintsGeoJson({
      map,
      nodes,
      models,
      modelDescriptions,
    });
    return geoJson.features;
  });

  fs.writeFileSync(
    path.join(args.outputDir, 'footprints.geojson'),
    JSON.stringify(
      {
        type: 'FeatureCollection',
        features: footprintFeatures,
      } as GeoJSON.FeatureCollection<GeoJSON.Polygon, FootprintProperties>,
      null,
      2,
    ),
  );

  logger.success('done.');
}

async function handleSpritesheetCommand(
  args: ReturnType<typeof spritesheetCommandBuilder>,
) {
  logger.log('creating overlays spritesheet...');
  const poiJsons = fs
    .readdirSync(args.inputDir, { withFileTypes: true })
    .filter(f => !f.isDirectory() && f.name.endsWith('-pois.json'))
    .map(f => path.join(args.inputDir, f.name));
  if (poiJsons.length === 0) {
    throw new Error('no -pois.json files found!');
  }
  const pois = poiJsons.flatMap(p => readArrayFile<Poi>(p));
  const { image, coordinates } = await createSpritesheet(
    pois,
    args.inputDir,
    path.join(__dirname, 'resources'),
  );
  logger.log('writing sprites(@2x).{json,png}...');
  // TODO downscale png to make a proper 1x spritesheet.
  fs.writeFileSync(path.join(args.outputDir, 'sprites.png'), image);
  fs.writeFileSync(path.join(args.outputDir, 'sprites@2x.png'), image);
  fs.writeFileSync(
    path.join(args.outputDir, 'sprites.json'),
    JSON.stringify(coordinates, null, 2),
  );
  fs.writeFileSync(
    path.join(args.outputDir, 'sprites@2x.json'),
    JSON.stringify(coordinates, null, 2),
  );
  logger.success('done.');
}

function handleGraphCommand(args: ReturnType<typeof graphCommandBuilder>) {
  // TODO read only the files necessary
  const tsMapData = readMapData(args.inputDir, args.map, {
    includeHidden: false,
  });

  const graph = generateGraph(tsMapData);
  if (args.check) {
    checkGraph(graph, tsMapData);
  }

  if (!args.dryRun) {
    if (args.demo) {
      fs.writeFileSync(
        path.join(args.outputDir, `${args.map}-graph-demo.json`),
        JSON.stringify(toDemoGraph(graph, tsMapData)),
      );
    } else {
      fs.writeFileSync(
        path.join(args.outputDir, `${args.map}-graph.json`),
        JSON.stringify([...graph.entries()], null, 2),
      );
    }
  }
  logger.success('done.');
}

function handleMapCommand(args: ReturnType<typeof mapCommandBuilder>) {
  const startTime = Date.now();

  if (args.type.includes('pmtiles')) {
    // TODO verify tippecanoe is installed
  }

  let focusOptions: FocusOptions | undefined;
  if (args.focusCity) {
    focusOptions = {
      type: 'city',
      city: args.focusCity,
      radiusMeters: args.focusRadius,
    };
  } else if (args.focusGameCoords) {
    const coords = args.focusGameCoords.split(',').map(c => parseFloat(c));
    if (coords.length !== 2 || coords.some(c => isNaN(c))) {
      throw new Error('invalid game coords');
    }
    focusOptions = {
      type: 'coords',
      coords: coords as [number, number],
      radiusMeters: args.focusRadius,
    };
  }

  console.log(args.map);
  const tsMapData = readMapData(args.inputDir, args.map, {
    includeHidden: args.includeHidden,
    focus: focusOptions,
  });

  logger.log('converting parsed map data to GeoJSON...');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const popPlacesGeoJson = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        'resources',
        // from https://github.com/nvkelso/natural-earth-vector
        'ne_10m_populated_places_simple.geojson',
      ),
      'utf-8',
    ),
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const geoJson = convertToGeoJson(args.map, tsMapData, popPlacesGeoJson, {
    includeDebug: args.includeDebug,
    skipCoalescing: args.skipCoalescing,
  });
  let geoJsonPath: string | undefined;
  const gamePrefix = args.map === 'usa' ? 'ats' : 'ets2';
  if (!args.dryRun && args.type.includes('geojson')) {
    geoJsonPath = path.join(args.outputDir, `${gamePrefix}.geojson`);
    logger.log('writing GeoJSON files...');
    fs.writeFileSync(geoJsonPath, JSON.stringify(geoJson, null, 2));
  }
  if (!args.dryRun && args.type.includes('pmtiles')) {
    let cleanupGeoJson = false;
    if (geoJsonPath == null) {
      geoJsonPath = path.join(os.tmpdir(), `${gamePrefix}.geojson`);
      logger.log('writing temporary GeoJSON files...');
      fs.writeFileSync(geoJsonPath, JSON.stringify(geoJson, null, 2));
      cleanupGeoJson = true;
    }

    // Minimum attributes required for map styling to work
    // (see `['get', $somAttributeName]` and `text-field: '{someAttributeName}'`
    // expressions in map styles).
    const minAttributes = [
      'type',
      'zIndex',
      'height',
      'hidden',
      'poiType',
      'poiName',
      'sprite',
      'scaleRank',
      'capital',
      'roadType',
      'color',
      'name',
    ];
    // write to tmp dir, in case webpack-dev-server is watching (we don't
    // want crazy reloads while the file is being written to)
    const tmpPmTilesPath = path.join(os.tmpdir(), `${gamePrefix}.pmtiles`);
    const tmpPmTilesLog = path.join(os.tmpdir(), `${gamePrefix}.pmtiles.log`);
    const cmd =
      // min-zoom 4, max-zoom 14.
      // max-zoom shouldn't be too low, otherwise rounding artifacts will
      // appear, like rectangles that look like trapezoids.
      `tippecanoe -Z4 -z13 ` +
      (args.minAttrs ? minAttributes.map(a => `-y ${a}`).join(' ') + ' ' : '') +
      `-B 4 ` + // -B 4 preserves all points, starting at zoom 4
      `-b 10` + // -b 10 helps with tile-boundary weirdness
      ` --force -o ${tmpPmTilesPath} ${geoJsonPath} ` +
      `> ${tmpPmTilesLog} 2>&1`;

    logger.log('running tippecanoe to generate pmtiles file...');
    logger.info('  ', cmd);
    execSync(cmd);
    logger.log(
      '\n',
      'tippecanoe output:\n',
      fs
        .readFileSync(tmpPmTilesLog, 'utf-8')
        .split('\n')
        .map(l => `  ${l}`)
        .join('\n'),
      '\n',
    );

    const pmTilesPath = path.join(args.outputDir, `${gamePrefix}.pmtiles`);
    fs.renameSync(tmpPmTilesPath, pmTilesPath);
    fs.rmSync(tmpPmTilesLog);
    if (cleanupGeoJson) {
      logger.log('deleting temporary GeoJSON files...');
      fs.rmSync(geoJsonPath);
    }
  }

  const endTime = Date.now();
  logger.success(
    'done! time elapsed:',
    `${((endTime - startTime) / 1000).toFixed(1)}s`,
  );
}

function toCityFeature(
  map: 'usa' | 'europe',
  countryCode: string,
  city: City,
): ScopedCityFeature {
  const fromGameToWgs84 =
    map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;
  const toCoords = (c: City) => {
    const cityArea = assertExists(c.areas.find(a => !a.hidden));
    return fromGameToWgs84([
      c.x + cityArea.width / 2,
      c.y + cityArea.height / 2,
    ]).map(coord => Number(coord.toFixed(4)));
  };

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: toCoords(city),
    },
    properties: {
      type: 'city',
      map,
      countryCode,
      name: city.name,
    },
  };
}

function toCountryFeature(
  map: 'usa' | 'europe',
  country: Country,
): ScopedCountryFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [],
    },
    properties: {
      type: 'country',
      map,
      code: country.code,
      name: country.name,
    },
  };
}

function handleCitiesCommand(args: ReturnType<typeof citiesCommandBuilder>) {
  logger.log('creating cities.geojson...');

  const toJsonPath = (map: 'usa' | 'europe', suffix: string) =>
    path.join(args.inputDir, `${map}-${suffix}.json`);

  const cityAndCountryFeatures = args.map.flatMap(map => {
    const countries = readArrayFile<Country>(toJsonPath(map, 'countries'));
    const countriesByToken = new Map(countries.map(c => [c.token, c]));
    const cities = readArrayFile<City>(toJsonPath(map, 'cities'));
    return [
      ...cities.map(city => {
        if (city.countryToken.toLowerCase() !== city.countryToken) {
          logger.warn(
            'country token',
            city.countryToken,
            'for city',
            city.name,
            "isn't completely lowercase",
          );
        }
        const country = countriesByToken.get(city.countryToken.toLowerCase());
        if (!country) {
          throw new Error(`no country found for token ${city.countryToken}`);
        }
        return toCityFeature(map, country.code, city);
      }),
      ...countries.map(country => toCountryFeature(map, country)),
    ];
  });

  const citiesGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: cityAndCountryFeatures,
  };
  fs.writeFileSync(
    path.join(args.outputDir, 'cities.geojson'),
    JSON.stringify(citiesGeoJson, null, 2),
  );
  logger.info(
    cityAndCountryFeatures.filter(f => f.properties.type === 'city').length,
    'cities',
  );
  logger.info(
    cityAndCountryFeatures.filter(f => f.properties.type === 'country').length,
    'states/countries',
  );
  logger.success('done.');
}

void (async () => {
  await main();
})();
