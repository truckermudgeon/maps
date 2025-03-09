import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import {
  achievementsMapDataKeys,
  convertToAchievementsGeoJson,
} from '../geo-json/achievements';
import { logger } from '../logger';
import { readMapData } from '../mapped-data';
import { writeGeojsonFile } from '../write-geojson-file';
import { maybeEnsureOutputDir, untildify } from './path-helpers';

export const command = 'achievements';
export const describe =
  'Generates achievements.geojson from map-parser JSON files';

export const builder = (yargs: Argv) =>
  yargs
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
      describe: 'Path to dir containing achievements.json files',
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
    .option('dryRun', {
      describe: "Don't write out any files.",
      type: 'boolean',
      default: false,
    })
    .check(maybeEnsureOutputDir);

export function handler(args: BuilderArguments<typeof builder>) {
  for (const map of [args.map].flat()) {
    const tsMapData = readMapData(args.inputDir, map, {
      mapDataKeys: achievementsMapDataKeys,
    });
    const geoJson = convertToAchievementsGeoJson(tsMapData);
    if (args.dryRun) {
      continue;
    }

    const gamePrefix = map === 'usa' ? 'ats' : 'ets2';
    const geojsonFilename = `${gamePrefix}-achievements.geojson`;
    const geoJsonPath = path.join(args.outputDir, geojsonFilename);
    logger.log(
      'writing',
      geoJson.features.length,
      'entries to',
      geoJsonPath + '...',
    );
    writeGeojsonFile(geoJsonPath, geoJson);
  }

  logger.success('done.');
}
