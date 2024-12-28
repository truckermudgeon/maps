import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import { convertToPrefabCurvesGeoJson } from '../geo-json/prefab-curves';
import { logger } from '../logger';
import type { FocusOptions } from '../mapped-data';
import { readMapData } from '../mapped-data';
import { writeGeojsonFile } from '../write-geojson-file';
import { maybeEnsureOutputDir, untildify } from './path-helpers';

export const command = 'prefab-curves';
export const describe =
  'Generates {usa,europe}-prefab-curves.geojson from map-parser JSON files';

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
    .option('inputDir', {
      alias: 'i',
      describe: 'Path to dir containing parser-generated JSON files',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir prefab-curves.geojson should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .check(maybeEnsureOutputDir)
    .check(argv => {
      if (Array.isArray(argv.map)) {
        throw new Error('Only one "map" option can be specified.');
      }
      return true;
    });

export function handler(args: BuilderArguments<typeof builder>) {
  logger.log('creating prefab-curves.geojson...');

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
    includeHidden: false,
    focus: focusOptions,
  });

  writeGeojsonFile(
    path.join(args.outputDir, `${args.map}-prefab-curves.geojson`),
    convertToPrefabCurvesGeoJson(tsMapData),
  );
  logger.success('done.');
}
