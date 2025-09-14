#!/usr/bin/env -S npx tsx

import * as process from 'process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as achievements from './commands/achievements';
import * as contours from './commands/contours';
import * as ets2Villages from './commands/ets2-villages';
import * as extraLabels from './commands/extra-labels';
import * as footprints from './commands/footprints';
import * as graph from './commands/graph';
import * as map from './commands/map';
import * as prefabCurves from './commands/prefab-curves';
import * as search from './commands/search';
import * as spritesheet from './commands/spritesheet';

async function main() {
  await yargs(hideBin(process.argv))
    .wrap(yargs().terminalWidth()) // Use full width of wide terminals.
    .command(map)
    .command(prefabCurves)
    .command(ets2Villages)
    .command(extraLabels)
    .command(footprints)
    .command(contours)
    .command(achievements)
    .command(spritesheet)
    .command(graph)
    .command(search)
    .demandCommand()
    .check(argv => {
      if (argv._.length !== 1) {
        throw new Error('Only one command can be given at a time.');
      }
      return true;
    })
    .parse();
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

await main();
