import { applyWSSHandler } from '@trpc/server/adapters/ws';
import type { IncomingMessage } from 'http';
import type { WebSocket, WebSocketServer } from 'ws';
import { createContext } from '../../trpc/context';
import { appRouter } from '../../trpc/router';
import { logger } from '../logging/logger';
import type { Services } from '../services';
import { wsRegistry } from './registry';

export function attachWSServer({
  wss,
  services,
}: {
  wss: WebSocketServer;
  services: Services;
}) {
  const { metrics, sessionActors } = services;
  // connCtx comes from `infr/ws/upgrade.tx`
  wss.on(
    'connection',
    (
      ws: WebSocket,
      _req: IncomingMessage,
      connCtx: { ip: string; websocketKey: string },
    ) => {
      const state = {
        ip: connCtx.ip,
        websocketKey: connCtx.websocketKey,
        connectedAt: Date.now(),
        subscriptions: new Map<string, number>(),
      };
      wsRegistry.set(ws, state);

      metrics.ws.connectionsOpened.inc();
      metrics.ws.connectionsActive.inc();

      ws.once('close', (code, reason) => {
        const connectionCtx = wsRegistry.get(ws);
        const meta = {
          code,
          reason: reason.toString(),
          connection: connectionCtx
            ? {
                websocketKey: connectionCtx.websocketKey,
                connectedAt: connectionCtx.connectedAt,
              }
            : undefined,
        };

        if (connectionCtx) {
          const maybeActor = sessionActors.getByClientId(
            connectionCtx.websocketKey,
          );
          maybeActor?.detachClient(connectionCtx.websocketKey);
        }

        if (code === 1000) {
          logger.info('closing ws connection', meta);
        } else {
          logger.warn('closing ws connection', meta);
        }
        wsRegistry.delete(ws);

        metrics.ws.connectionsActive.dec();
        metrics.ws.connectionsClosed.inc();
        metrics.ws.connectionLifetimeMs.observe(Date.now() - state.connectedAt);
      });
    },
  );

  applyWSSHandler({
    wss,
    router: appRouter,
    createContext: opts =>
      createContext({
        ...opts,
        services,
        wsRegistry,
      }),
  });

  return wsRegistry;
}
