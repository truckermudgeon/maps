import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { observable } from '@trpc/server/observable';
import type { TruckSimTelemetry } from '@truckermudgeon/api/types';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { WebSocketServer } from 'ws';
import { publicProcedure, router } from './trpc.js';

let getTelemetry: () => TruckSimTelemetry | undefined = () => undefined;

const appRouter = router({
  onTelemetry: publicProcedure.subscription(() => {
    console.log('subscribing to telemetry::onTelemetry');
    return observable<TruckSimTelemetry>(emit => {
      const intervalId = setInterval(() => {
        const telemetry = getTelemetry();
        if (telemetry) {
          emit.next(telemetry);
        } else {
          console.log('telemetry::onTelemetry complete');
          emit.complete();
          clearInterval(intervalId);
        }
      }, 500);

      return () => {
        console.log('unsubscribing from telemetry::onTelemetry');
        clearInterval(intervalId);
      };
    });
  }),
});

export type AppRouter = typeof appRouter;

// cheap args processing:
//   first arg is optional and specifies a telemetry mode: 'recorded' or 'live'.
//   if not present, telemetry mode is assumed to be 'recorded'.
async function main() {
  const telemetryMode = process.argv.slice(2)[0] ?? 'recorded';
  switch (telemetryMode) {
    case 'recorded': {
      console.log('using recorded telemetry');
      const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
      const logFile = fs.readFileSync(
        path.join(__dirname, 'recordings', 'socal-log.txt'),
        'utf-8',
      );
      const fakeEntries = logFile
        .split('\n')
        .filter(l => l !== '')
        .map(json => JSON.parse(json) as TruckSimTelemetry | undefined);
      let entryIndex = 0;
      getTelemetry = () => {
        if (entryIndex === fakeEntries.length) {
          entryIndex = 0;
        }
        return fakeEntries[entryIndex++];
      };
      break;
    }
    case 'live': {
      console.log('using live telemetry');
      // can't install trucksim-telemetry on macOS because it's Windows-only.
      // eslint-disable-next-line
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const tst = (await import('trucksim-telemetry')).default;
      // eslint-disable-next-line
      getTelemetry = () => tst.getData() as TruckSimTelemetry | undefined;
      break;
    }
    default:
      throw new Error('unrecognized telemetry mode: ' + telemetryMode);
  }

  const { server, listen } = createHTTPServer({ router: appRouter });
  const wss = new WebSocketServer({ server });
  applyWSSHandler<AppRouter>({ wss, router: appRouter });
  listen(3001);
  console.log('telemetry server listening at http://localhost:3001');
}

await main();
