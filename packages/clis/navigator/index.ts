#!/usr/bin/env -S npx tsx

import { renderANSI } from 'uqr';
import { apiUrl, healthUrl, navigatorUrl, NODE_ENV } from './constants';
import type { TelemetryReaderOptions } from './helpers';
import {
  checkIsServerUp,
  connectToServer,
  createTelemetryClient,
  createTelemetryReader,
  getTelemetryId,
  startTelemetryLoop,
} from './helpers';

async function main() {
  const telemetryReaderOptions = parseArguments(process.argv);
  const getTelemetry = createTelemetryReader(telemetryReaderOptions);
  //checkIsPluginInstalled();

  const isServerUp = await checkIsServerUp(healthUrl);
  if (!isServerUp) {
    process.exit(1);
  }

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
        `visit ${navigatorUrl} and enter pairing code:

        `,
        pairingCode,
        '\n\n',
      );
      if (NODE_ENV === 'production') {
        console.log('or scan this qr code:\n\n');
        console.log(renderANSI(`${navigatorUrl}/?pair=${pairingCode}`));
      }
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
