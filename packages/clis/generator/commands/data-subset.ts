import type { MapDataKeys } from '@truckermudgeon/io';
import { readMapData, writeArrayFile } from '@truckermudgeon/io';
import fs from 'fs';
import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import { logger } from '../logger';
import { parseFocusOptions } from './focus-options';
import { maybeEnsureOutputDir, untildify } from './path-helpers';

export const command = 'data-subset';
export const describe =
  'Reads parser-generated JSON files, applies focus filtering, and writes the filtered subset back out as JSON files.';

const allMapDataKeys = [
  // MapData
  'nodes',
  'elevation',
  'roads',
  'ferries',
  'prefabs',
  'companies',
  'models',
  'mapAreas',
  'pois',
  'dividers',
  'trajectories',
  'triggers',
  'signs',
  'cutscenes',
  'cities',
  // DefData
  'countries',
  'companyDefs',
  'roadLooks',
  'prefabDescriptions',
  'modelDescriptions',
  'signDescriptions',
  'achievements',
  'routes',
  'mileageTargets',
  'cargoes',
] satisfies MapDataKeys;

export const builder = (yargs: Argv) =>
  yargs
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
        'City to focus on. Output files will only contain objects within `focusRadius`.',
      type: 'string',
      conflicts: 'focusGameCoords',
    })
    .option('focusGameCoords', {
      alias: 'c',
      describe:
        'Game coords to focus on, in "x,y" format (e.g., "-35578,20264"). Output files will only contain objects within `focusRadius`.',
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
      describe: 'Path to dir filtered files should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
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
      if (path.resolve(argv.inputDir) === path.resolve(argv.outputDir)) {
        throw new Error('inputDir and outputDir must be different.');
      }
      return true;
    });

export function handler(args: BuilderArguments<typeof builder>) {
  const startTime = Date.now();

  const focusOptions = parseFocusOptions(args);

  const tsMapData = readMapData(args.inputDir, args.map, {
    includeHiddenRoadsAndPrefabs: true,
    focus: focusOptions,
    mapDataKeys: allMapDataKeys,
  });

  for (const key of allMapDataKeys) {
    const value = tsMapData[key];
    const arr = Array.isArray(value) ? value : [...value.values()];
    const filename = `${args.map}-${key}.json`;
    if (args.dryRun) {
      logger.log('would write', arr.length, `entries to ${filename}`);
    } else {
      logger.log('writing', arr.length, `entries to ${filename}...`);
      writeArrayFile(arr, path.join(args.outputDir, filename));
    }
  }

  const versionFilename = `${args.map}-version.txt`;
  const versionSrc = path.join(args.inputDir, versionFilename);
  if (fs.existsSync(versionSrc)) {
    if (args.dryRun) {
      logger.log('would copy', versionFilename);
    } else {
      fs.copyFileSync(versionSrc, path.join(args.outputDir, versionFilename));
      logger.log('copied', versionFilename);
    }
  }

  const endTime = Date.now();
  logger.success(
    'done! time elapsed:',
    `${((endTime - startTime) / 1000).toFixed(1)}s`,
  );
}
