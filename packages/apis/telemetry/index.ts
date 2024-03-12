import type {
  Telemetry,
  TelemetryServerToClientEvents,
  TruckSimTelemetry,
} from '@truckermudgeon/api/types';
import express from 'express';
import fs from 'fs';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverName = path.basename(__dirname);
const app = express();
const server = createServer(app);
const io = new Server<never, TelemetryServerToClientEvents>(server);

let getTelemetry: () => Telemetry | undefined;

try {
  // can't install trucksim-telemetry on macOS because it's Windows-only.

  // eslint-disable-next-line
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
  const tst = (await import('trucksim-telemetry')).default;
  console.log('real telemetry mode');

  getTelemetry = () => {
    // eslint-disable-next-line
    const data = tst.getData() as TruckSimTelemetry | undefined;
    return data ? toTelemetry(data) : undefined;
  };
} catch {
  console.log('fake telemetry mode');

  const recordingPath = path.join(
    __dirname,
    'recordings',
    'hays-to-san-angelo.json',
  );
  const fakeEntries = JSON.parse(
    fs.readFileSync(recordingPath, 'utf-8'),
  ) as Telemetry[];
  let entryIndex = 0;
  getTelemetry = () => {
    if (entryIndex === fakeEntries.length) {
      entryIndex = 0;
    }
    return fakeEntries[entryIndex++];
  };
}

io.on('connection', socket => {
  console.log(`${serverName} user connected`);
  socket.on('disconnect', () => {
    console.log(`${serverName} user disconnected`);
    clearInterval(intervalId);
  });

  const intervalId = setInterval(() => {
    const telemetry = getTelemetry();
    if (telemetry) {
      socket.emit('update', telemetry);
    }
  }, 500);
});

server.listen(3000, () => {
  console.log(`${serverName} listening on 3000`);
});

function toTelemetry(data: TruckSimTelemetry): Telemetry {
  const { truck, job, navigation, game } = data;
  return {
    position: truck.position,
    heading: truck.orientation.heading,
    speed: truck.speed,
    source: job.source,
    destination: job.destination,
    speedLimit: navigation.speedLimit,
    timestamp: game.timestamp,
    scale: game.scale,
  };
}
