#!/usr/bin/env -S npx tsx

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as process from 'process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { parseMapFiles } from './game-files/map-files-parser';
import type { MapData } from './game-files/types';
import { logger } from './logger';

const homeDirectory = os.homedir();
const untildify = (path: string) =>
  homeDirectory ? path.replace(/^~(?=$|\/|\\)/, homeDirectory) : path;

function main() {
  const args = yargs(hideBin(process.argv))
    .usage(
      'Parses ATS game data and outputs map JSON and PNG files.\nUsage: $0 -i <dir> -o <dir>',
    )
    .option('inputDir', {
      alias: 'i',
      describe: 'Path to ATS game dir (the one with all the .scs files)',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('outputDir', {
      alias: 'o',
      describe: 'Path to dir JSON and PNG files should be written to',
      type: 'string',
      coerce: untildify,
      demandOption: true,
    })
    .option('includeDlc', {
      describe: 'parse DLC files',
      type: 'boolean',
      default: true,
    })
    .option('dryRun', {
      describe: "Don't write out any files.",
      type: 'boolean',
      default: false,
    })
    .parse();

  const scsFilePaths = fs
    .readdirSync(args.inputDir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.scs'))
    .map(e => path.join(args.inputDir, e.name));

  const { map, mapData, icons } = parseMapFiles(scsFilePaths, args.includeDlc);
  if (args.dryRun) {
    logger.success('dry run complete.');
    return;
  }

  if (!fs.existsSync(args.outputDir)) {
    fs.mkdirSync(args.outputDir, { recursive: true });
  }
  for (const key of Object.keys(mapData)) {
    const collection = mapData[key as keyof MapData];
    const filename = `${map}-${key}.json`;
    logger.log('writing', collection.length, `entries to ${filename}...`);
    fs.writeFileSync(
      path.join(args.outputDir, filename),
      JSON.stringify(collection, null, 2),
    );
  }
  const pngOutputDir = path.join(args.outputDir, 'icons');
  logger.log('writing', icons.size, `.png files to ${pngOutputDir}...`);
  if (!fs.existsSync(pngOutputDir)) {
    fs.mkdirSync(pngOutputDir);
  }
  for (const [name, buffer] of icons) {
    fs.writeFileSync(path.join(pngOutputDir, name + '.png'), buffer);
  }
  logger.success('done.');
}

// Ensure `BigInt`s are `JSON.serialize`d as hex strings, so they can be
// `JSON.parse`d without any data loss.
//
// Do this before calling `main()` (or executing any other code that might
// involve serializing bigints to JSON).

// eslint-disable-next-line
interface BigIntWithToJSON extends BigInt {
  toJSON(): string;
}

(BigInt.prototype as BigIntWithToJSON).toJSON = function () {
  return this.toString(16);
};

main();
