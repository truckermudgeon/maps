import { readGraphData, readMapData } from '@truckermudgeon/io';
import fs from 'fs';
import type { Argv, BuilderArguments } from 'yargs';
import { logger } from '../logger';
import {
  detectCompositeRoundabouts,
  detectRoundaboutsMapDataKeys,
  filterCycles,
} from '../roundabouts/detect-roundabouts';
import { maybeEnsureOutputDir, untildify } from './path-helpers';

export const command = 'roundabouts';
export const describe =
  'Generates {usa,europe}-roundabouts.json from map-parser JSON files';

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
    .option('graphDir', {
      alias: 'g',
      describe: 'Path to dir containing {usa,europe}-graph.json file',
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
  const graphData = readGraphData(args.graphDir, args.map);
  const tsMapData = readMapData(args.inputDir, args.map, {
    mapDataKeys: detectRoundaboutsMapDataKeys,
  });

  if (Math.random() > 2) {
    detectCompositeRoundabouts(graphData.graph, tsMapData);
  }

  const cycles = JSON.parse(
    fs.readFileSync('cycles.json', 'utf-8'),
  ) as string[][];
  filterCycles(cycles, tsMapData);

  logger.success('done.');
}
