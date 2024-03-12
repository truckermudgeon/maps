import type {
  GameState,
  NavigationServerToClientEvents,
  Telemetry,
  TelemetryServerToClientEvents,
} from '@truckermudgeon/api/types';
import { fromAtsCoordsToWgs84 } from '@truckermudgeon/map/projections';
import bearing from '@turf/bearing';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverName = path.basename(__dirname);
const app = express();
const server = createServer(app);
/** The socket between this server and users' browsers. */
const serverSocket = new Server<never, NavigationServerToClientEvents>(server, {
  cors: {
    origin: '*',
  },
});
/** The socket between the telemetry server and this server. */
const telemetrySocket = io(
  'ws://localhost:3000',
  //'ws://192.168.0.229:3000',
) as Socket<TelemetryServerToClientEvents>;

telemetrySocket.on('connect', () =>
  console.log(`${serverName} connected to telemetry server`),
);

serverSocket.on('connect', socket => {
  console.log(`${serverName} user connected`);

  const gameState: GameState = {
    speedMph: 0,
    position: [0, 0],
    bearing: 0,
    speedLimit: 0,
    scale: 0,
  };
  const onUpdate = (telemetry: Telemetry) =>
    updateGameState(gameState, telemetry);
  telemetrySocket.on('update', onUpdate);

  socket.on('disconnect', () => {
    console.log(`${serverName} user disconnected`);
    clearInterval(intervalId);
    telemetrySocket.off('update', onUpdate);
  });

  const intervalId = setInterval(() => {
    socket.emit('updatePosition', gameState);
  }, 500);
});

server.listen(3001, () => {
  console.log(`${serverName} listening on 3001`);
});

function updateGameState(gameState: GameState, telemetry: Telemetry) {
  const position = fromAtsCoordsToWgs84([
    telemetry.position.X,
    telemetry.position.Z,
  ]);
  const theta = (0.5 - telemetry.heading) * Math.PI * 2 + Math.PI / 2;
  const lookAt = fromAtsCoordsToWgs84([
    telemetry.position.X + 1000 * Math.cos(theta),
    telemetry.position.Z + 1000 * Math.sin(theta),
  ]);

  gameState.speedMph = telemetry.speed.mph;
  gameState.position = position;
  gameState.bearing = bearing(position, lookAt, { final: false });
  gameState.speedLimit = telemetry.speedLimit.mph;
  gameState.scale = telemetry.scale;
}
