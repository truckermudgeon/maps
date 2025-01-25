import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { observable } from '@trpc/server/observable';
import type { GameState, TruckSimTelemetry } from '@truckermudgeon/api/types';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { PoiType, ScopeType } from './constants';
import { toGameState } from './game-state';
import { listenToTelemetry } from './telemetry';
import { publicProcedure, router } from './trpc';
import type {
  Route,
  RouteDirection,
  SearchResult,
  TrailerState,
} from './types';

const { telemetryEventEmitter } = listenToTelemetry();

const appRouter = router({
  search: publicProcedure
    .input(
      z.object({
        type: z.nativeEnum(PoiType),
        scope: z.nativeEnum(ScopeType),
      }),
    )
    .query<SearchResult[]>(() => {
      return [];
    }),
  previewRoutes: publicProcedure
    .input(
      z.object({
        toNodeUid: z.string(),
      }),
    )
    .query<Route[]>(() => {
      return [];
    }),
  setActiveRoute: publicProcedure
    .input(z.optional(z.array(z.string())))
    .mutation(() => {
      return;
    }),
  onPositionUpdate: publicProcedure.subscription(() =>
    observable<GameState>(emit => {
      const onTelemetry = (telemetry: TruckSimTelemetry) =>
        emit.next(toGameState(telemetry));
      telemetryEventEmitter.on('telemetry', onTelemetry);
      return () => telemetryEventEmitter.off('telemetry', onTelemetry);
    }),
  ),
  onRouteUpdate: publicProcedure.subscription(() =>
    observable<Route | undefined>(() => {
      return () => void 0;
    }),
  ),
  onDirectionUpdate: publicProcedure.subscription(() =>
    observable<RouteDirection | undefined>(() => {
      return () => void 0;
    }),
  ),
  onTrailerUpdate: publicProcedure.subscription(() =>
    observable<TrailerState | undefined>(() => {
      return () => void 0;
    }),
  ),
});

// Export type router type signature, this is used by the client.
export type AppRouter = typeof appRouter;

const httpServer = createHTTPServer({ router: appRouter });
applyWSSHandler<AppRouter>({
  wss: new WebSocketServer({ server: httpServer.server }),
  router: appRouter,
});
httpServer.listen(3000);
console.log('navigation server listening at http://localhost:3000');
