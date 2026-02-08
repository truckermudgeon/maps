import fs from 'node:fs';
import readline from 'node:readline';
import zlib from 'node:zlib';
import type { TelemetryData } from 'trucksim-telemetry';
import tst from 'trucksim-telemetry';

export type TelemetryReaderOptions =
  | {
      mode: 'recorded';
      filepath: string;
    }
  | {
      mode: 'live';
    };

export type TelemetryReader = () => TelemetryData | undefined;

export function createTelemetryReader(
  opts: TelemetryReaderOptions,
): TelemetryReader {
  let getTelemetry: () => TelemetryData | undefined = () => undefined;
  switch (opts.mode) {
    case 'recorded': {
      const { filepath } = opts;
      console.log('using recorded telemetry', filepath);
      const logFile = zlib.unzipSync(fs.readFileSync(filepath)).toString();
      const fakeEntries = logFile
        .split('\n')
        .filter(l => l !== '')
        .map(json => JSON.parse(json) as TelemetryData | undefined);

      let entryIndex = 0;
      let paused = false;
      getTelemetry = () => {
        if (entryIndex === fakeEntries.length) {
          entryIndex = 0;
        }
        const telemetry = fakeEntries[entryIndex];
        if (!paused) {
          entryIndex++;
        }
        return telemetry;
      };

      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.setRawMode != null) {
        process.stdin.setRawMode(true);
      }
      const keypressListener = (
        _: unknown,
        key: { ctrl: boolean; shift: boolean; name: string },
      ) => {
        if (key.ctrl && key.name === 'c') {
          process.exit();
        }

        const delta = key.shift ? 10 : 1;
        if (key.name === 'space') {
          paused = !paused;
          console.log('paused:', paused);
        } else if (key.name === 'left') {
          entryIndex = Math.max(0, entryIndex - delta);
          console.log('progress:', entryIndex, '/', fakeEntries.length - 1);
        } else if (key.name === 'right') {
          entryIndex = Math.min(entryIndex + delta, fakeEntries.length - 1);
          console.log('progress:', entryIndex, '/', fakeEntries.length - 1);
        }
      };
      process.stdin.on('keypress', keypressListener);
      process.on('exit', () => process.stdin.off('keypress', keypressListener));
      break;
    }
    case 'live': {
      getTelemetry = tst.getData;
      break;
    }
    default:
      console.log(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `unknown telemetry options "${opts}". mode must be either "live" or "recorded".`,
      );
      process.exit(-1);
  }

  return getTelemetry;
}
