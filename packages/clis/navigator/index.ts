#!/usr/bin/env -S npx tsx

import { checkIsServerUp } from './check-server';
import { connectToServer } from './connect-to-server';
import { createTelemetryClient } from './create-telemetry-client';
import type { TelemetryReaderOptions } from './get-telemetry';
import { createTelemetryReader } from './get-telemetry';
import { startTelemetryLoop } from './start-telemetry-loop';
import { getTelemetryId } from './telemetry-id';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const apiUrl =
  NODE_ENV === 'development'
    ? 'ws://localhost:62840/telemetry'
    : 'wss://api.truckermudgeon.com/telemetry';
const healthUrl =
  NODE_ENV === 'development'
    ? 'http://localhost:62840/health'
    : 'https://api.truckermudgeon.com/health';

async function main() {
  const telemetryReaderOptions = parseArguments(process.argv);
  const getTelemetry = createTelemetryReader(telemetryReaderOptions);
  //checkIsPluginInstalled();

  await checkIsServerUp(healthUrl);
  // TODO add simple check if client is outdated
  const telemetryClient = createTelemetryClient({
    apiUrl,
    onError: (maybeEvent: Event | undefined) => {
      console.error(maybeEvent);
      console.error(
        'error while trying to connect to server. try again later.',
      );
      process.exit(8);
    },
    onClose: (maybeCause: { code?: number } | undefined) => {
      console.log('socket closed:', maybeCause);
      if (maybeCause?.code === 1001) {
        console.log('the server shut down.');
      }
      process.exit(maybeCause?.code ?? 7);
    },
  });

  // server handshake
  const telemetryId = getTelemetryId();
  await connectToServer({
    telemetryClient,
    telemetryId,
    onPairingCodeReceived: pairingCode => {
      console.log(
        'visit https://navigator.truckermudgeon.com and enter pairing code:\n\n        ',
        pairingCode,
        '\n\n',
      );
    },
  });

  // at this point, client is authenticated and can start sending telemetry.
  const pairingCode =
    await telemetryClient.requestAdditionalPairingCode.mutate();
  console.log(
    'to connect an additional device, use pairing code:',
    pairingCode,
  );

  // TODO only send telemetry if there are viewers connected.
  startTelemetryLoop({
    getTelemetry,
    telemetryClient,
    onError: err => {
      if (err instanceof Error) {
        console.log('error:', err.message);
      } else {
        console.log(err ?? 'unknown error');
      }
      process.exit(6);
    },
  });
}

function parseArguments(argv: string[]): TelemetryReaderOptions {
  let telemetryReaderOptions: TelemetryReaderOptions;
  const args = argv.slice(2);
  const telemetryMode = args[0] ?? 'live';
  if (telemetryMode === 'recorded') {
    if (!args[1]) {
      throw new Error('no recording file specified.');
    }
    telemetryReaderOptions = {
      mode: 'recorded',
      filepath: args[1],
    };
  } else if (telemetryMode === 'live') {
    telemetryReaderOptions = {
      mode: 'live',
    };
  } else {
    throw new Error(
      `unknown telemetry mode ${telemetryMode}. must be either "live" or "recorded".`,
    );
  }
  return telemetryReaderOptions;
}

process.on('exit', code => {
  console.log('process exit', code);
});

void main();
