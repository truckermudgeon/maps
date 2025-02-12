import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import { convertToMapGeoJson, geoJsonMapDataKeys } from '../geo-json/map';
import { logger } from '../logger';
import type { FocusOptions } from '../mapped-data';
import { readMapData } from '../mapped-data';
import { maybeEnsureOutputDir, untildify } from './path-helpers';

export const command = 'map';
export const describe =
  'Generates {usa,europe}.{geojson,pmtiles,mbtiles} from map-parser JSON files';

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
      choices: ['pmtiles', 'geojson', 'mbtiles'] as const,
      default: ['pmtiles'] as ('pmtiles' | 'geojson' | 'mbtiles')[],
      defaultDescription: 'pmtiles',
    })
    .option('dryRun', {
      describe: "Don't write out any files.",
      type: 'boolean',
      default: false,
    })
    .option('minAttrs', {
      describe: "Don't write out unused GeoJSON attrs in pmtiles/mbtiles.",
      type: 'boolean',
      default: true,
    })
    .check(maybeEnsureOutputDir)
    .check(argv => {
      if (Array.isArray(argv.map)) {
        throw new Error('Only one "map" option can be specified.');
      }
      return true;
    });

export function handler(args: BuilderArguments<typeof builder>) {
  const startTime = Date.now();

  const types = Array.isArray(args.type) ? args.type : [args.type];
  if (types.includes('pmtiles') || types.includes('mbtiles')) {
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

  const tsMapData = readMapData(args.inputDir, args.map, {
    includeHiddenRoadsAndPrefabs: args.includeHidden,
    focus: focusOptions,
    mapDataKeys: geoJsonMapDataKeys,
  });

  logger.log('converting parsed map data to GeoJSON...');
  const geoJson = convertToMapGeoJson(tsMapData, {
    includeDebug: args.includeDebug,
    skipCoalescing: args.skipCoalescing,
  });
  let geoJsonPath: string | undefined;
  const gamePrefix = args.map === 'usa' ? 'ats' : 'ets2';
  if (!args.dryRun && types.includes('geojson')) {
    geoJsonPath = path.join(args.outputDir, `${gamePrefix}.geojson`);
    logger.log('writing GeoJSON files...');
    fs.writeFileSync(geoJsonPath, JSON.stringify(geoJson, null, 2));
  }
  if (!args.dryRun && types.some(t => t.endsWith('tiles'))) {
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
      'dlcGuard',
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

    for (const type of types.filter(t => t.endsWith('tiles'))) {
      // write to tmp dir, in case dev server is watching (we don't want crazy
      // reloads while the file is being written to)
      const tmpTilesPath = path.join(os.tmpdir(), `${gamePrefix}.${type}`);
      const tmpTilesLog = path.join(os.tmpdir(), `${gamePrefix}.${type}.log`);
      const cmd =
        // min-zoom 4, max-zoom 14.
        // max-zoom shouldn't be too low, otherwise rounding artifacts will
        // appear, like rectangles that look like trapezoids.
        `tippecanoe -Z4 -z13 ` +
        (args.minAttrs
          ? minAttributes.map(a => `-y ${a}`).join(' ') + ' '
          : '') +
        `-B 4 ` + // -B 4 preserves all points, starting at zoom 4
        `-b 10` + // -b 10 helps with tile-boundary weirdness
        ` --force -o ${tmpTilesPath} ${geoJsonPath} ` +
        `> ${tmpTilesLog} 2>&1`;

      logger.log(`running tippecanoe to generate ${type} file...`);
      logger.info('  ', cmd);
      execSync(cmd);
      logger.log(
        '\n',
        'tippecanoe output:\n',
        fs
          .readFileSync(tmpTilesLog, 'utf-8')
          .split('\n')
          .map(l => `  ${l}`)
          .join('\n'),
        '\n',
      );

      const tilesPath = path.join(args.outputDir, `${gamePrefix}.${type}`);
      fs.renameSync(tmpTilesPath, tilesPath);
      fs.rmSync(tmpTilesLog);
    }

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
