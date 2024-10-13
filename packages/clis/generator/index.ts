#!/usr/bin/env -S npx tsx

import * as process from 'process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as achievements from './commands/achievements';
import * as cities from './commands/cities';
import * as contours from './commands/contours';
import * as ets2Villages from './commands/ets2-villages';
import * as footprints from './commands/footprints';
import * as graph from './commands/graph';
import * as map from './commands/map';
import * as prefabCurves from './commands/prefab-curves';
import * as spritesheet from './commands/spritesheet';

async function main() {
  await yargs(hideBin(process.argv))
    .command(map)
    .command(prefabCurves)
    .command(cities)
    .command(ets2Villages)
    .command(footprints)
    .command(contours)
    .command(achievements)
    .command(spritesheet)
    .command(graph)
    .demandCommand()
    .check(argv => {
      if (argv._.length !== 1) {
        throw new Error('Only one command can be given at a time.');
      }
      return true;
    })
    .parse();
}

await main();
