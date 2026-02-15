import http from 'http';
import { WebSocketServer } from 'ws';
import { env } from './env';
import { createHttpHandler } from './infra/http/handler';
import { initServices } from './infra/services';
import type { WSRegistry } from './infra/ws/registry';
import { attachWSServer } from './infra/ws/server';
import { handleUpgrade } from './infra/ws/upgrade';

export function startServer(dataDir: string) {
  const services = initServices(dataDir);
  const server = http.createServer(createHttpHandler({ services }));
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    handleUpgrade(req, socket, head, { wss, services }).catch(err => {
      console.error('upgrade failed', err);
      socket.destroy();
    });
  });

  const wsRegistry = attachWSServer({
    wss,
    services,
  });

  setupShutdownHandlers({
    server,
    wss,
    wsRegistry,
  });

  server.listen(env.PORT, () =>
    console.log(`navigation server listening on port ${env.PORT}`),
  );
}

function setupShutdownHandlers(opts: {
  server: http.Server;
  wss: WebSocketServer;
  wsRegistry: WSRegistry;
}) {
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log('Shutdown started');

    // stop accepting new HTTP connections
    opts.server.close(() => console.log('HTTP server closed'));

    // stop accepting new WS upgrades
    opts.wss.close(() => console.log('WS server closed'));

    // notify connected clients
    for (const ws of opts.wsRegistry.keys()) {
      try {
        ws.close(1001, 'Server shutting down');
      } catch {
        // do nothing
      }
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
