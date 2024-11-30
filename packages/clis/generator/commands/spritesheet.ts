import type { Poi } from '@truckermudgeon/map/types';
import fs from 'fs';
import path from 'path';
import type { Argv, BuilderArguments } from 'yargs';
import { logger } from '../logger';
import { readArrayFile } from '../read-array-file';
import { createSpritesheet } from '../spritesheet';
import { maybeEnsureOutputDir, resourcesDir, untildify } from './path-helpers';

export const command = 'spritesheet';
export const describe =
  'Generates maplibre spritesheet files from map-parser JSON and PNG files';

export const builder = (yargs: Argv) =>
  yargs
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
    .check(maybeEnsureOutputDir);

export async function handler(args: BuilderArguments<typeof builder>) {
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
    resourcesDir,
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
