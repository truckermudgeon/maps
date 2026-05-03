import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { assert, assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
  fromWgs84ToAtsCoords,
  fromWgs84ToEts2Coords,
} from '@truckermudgeon/map/projections';
import type { RouteKey } from '@truckermudgeon/map/routing';
import { isRouteKey } from '@truckermudgeon/map/routing';
import crypto from 'node:crypto';
import { z } from 'zod';
import { PoiType, ScopeType } from '../../constants';
import { toGameState } from '../../domain/actor/game-state';
import {
  buildRouteFromNodeUids,
  generateRouteFromKeys,
} from '../../domain/actor/generate-routes';
import { computePreviewRoutes } from '../../domain/actor/preview-routes';
import type { SearchRequest } from '../../domain/actor/search';
import {
  createSearchRequest,
  createWithRelativeTruckInfoMapper,
} from '../../domain/actor/search';
import { AuthState } from '../../domain/auth/auth-state';
import { transition } from '../../domain/auth/transition';
import { subscribeSession } from '../../infra/actors/subscribe-session';
import { navigatorKeys } from '../../infra/kv/store';
import { logger } from '../../infra/logging/logger';
import type {
  ActorEvent,
  GameState,
  Route,
  RouteWithSummary,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
  TruckSimTelemetry,
} from '../../types';
import { publicProcedure, router } from '../init';
import { loggingMiddleware } from '../middleware/logging';
import { metricsMiddleware } from '../middleware/metrics';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { requireAuthState } from '../middleware/require-auth-state';
import { requireGameContext } from '../middleware/require-game-context';
import { requireNavigatorContext } from '../middleware/require-navigator-context';
import { requireSessionActor } from '../middleware/require-session-actor';
import { subscriptionLimitMiddleware } from '../middleware/subscription-limit';

const maxSearchResults = 10;

const navigatorProcedure = publicProcedure
  .use(loggingMiddleware)
  .use(metricsMiddleware)
  .use(requireNavigatorContext);
const navigatorSessionProcedure = navigatorProcedure
  .use(requireAuthState([AuthState.VIEWER_AUTHENTICATED]))
  .use(requireSessionActor);
const navigatorGameProcedure =
  navigatorSessionProcedure.use(requireGameContext);

export const navigatorRouter = router({
  redeemCode: navigatorProcedure
    .use(requireAuthState([AuthState.UNAUTHENTICATED]))
    .use(
      rateLimitMiddleware({
        maxCalls: 5,
        per: 'minute',
      }),
    )
    .input(z.object({ code: z.string().length(4) }))
    .mutation(async ({ ctx, input }) => {
      const {
        services: { kv, sessionActors },
      } = ctx;
      const { code } = input;

      const pairingInfo = await kv.get(navigatorKeys.pairing(code));
      if (!pairingInfo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'unknown code',
        });
      }

      pairingInfo.redeemed = true;
      if (pairingInfo.cleanupOnRedemption) {
        await kv.delete(navigatorKeys.pairing(code));
      } else {
        await kv.set(navigatorKeys.pairing(code), {
          ...pairingInfo,
          redeemed: true,
        });
      }

      const viewerId = crypto.randomUUID();
      // TODO store this in a db
      await kv.set(navigatorKeys.viewerId(viewerId), pairingInfo.telemetryId, {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
      });
      transition(ctx.auth, AuthState.VIEWER_AUTHENTICATED);
      assert(ctx.auth.state === AuthState.VIEWER_AUTHENTICATED);
      ctx.auth.viewerId = viewerId;

      const actor = sessionActors.getOrCreate(pairingInfo.telemetryId);
      if (!actor.attachClient(ctx.clientId)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Too many clients connected to this code',
        });
      }

      return {
        viewerId,
        telemetryId: pairingInfo.telemetryId,
      };
    }),
  reconnect: navigatorProcedure
    .use(
      requireAuthState([
        AuthState.VIEWER_AUTHENTICATED,
        AuthState.UNAUTHENTICATED,
      ]),
    )
    .use(
      rateLimitMiddleware({
        maxCalls: 5,
        per: 'minute',
      }),
    )
    .input(z.object({ viewerId: z.string().length(36) }))
    .mutation(async ({ path, ctx, input }) => {
      if (ctx.auth.state === AuthState.VIEWER_AUTHENTICATED) {
        return true;
      }

      const {
        services: { kv, sessionActors },
      } = ctx;
      const { viewerId } = input;

      const telemetryId = await kv.get(navigatorKeys.viewerId(viewerId));
      if (!telemetryId) {
        logger.warn('no telemetry id associated with viewer id: ' + viewerId, {
          trpc: {
            path,
            type: 'mutation',
          },
          request: {
            type: ctx.type,
            clientId: ctx.clientId,
          },
        });
        return false;
      }

      // Liveness probe: if the bound telemetryId has no live signal, the
      // binding is stale (e.g. the desktop client was re-paired and minted
      // a new telemetryId, leaving this viewerId pointing at a dead actor).
      // - publicKey: 12 h TTL, set at pairing. Indicates the device is
      //   recently authenticated.
      // - telemetry: 2 s TTL, refreshed on every push. Indicates the
      //   device is currently online and producing telemetry.
      // If neither exists, drop the stale viewerId mapping and force the
      // webapp back to the pairing form.
      const [hasPublicKey, hasRecentTelemetry] = await Promise.all([
        kv.has(navigatorKeys.publicKey(telemetryId)),
        kv.has(navigatorKeys.telemetry(telemetryId)),
      ]);
      if (!hasPublicKey && !hasRecentTelemetry) {
        logger.warn('stale viewer<->telemetry binding; clearing', {
          trpc: { path, type: 'mutation' },
          request: { type: ctx.type, clientId: ctx.clientId },
        });
        await kv.delete(navigatorKeys.viewerId(viewerId));
        return false;
      }

      transition(ctx.auth, AuthState.VIEWER_AUTHENTICATED);
      //assert(ctx.auth.state === AuthState.VIEWER_AUTHENTICATED);
      (ctx.auth as unknown as { viewerId: string }).viewerId = viewerId;

      const actor = sessionActors.getOrCreate(telemetryId);
      if (!actor.attachClient(ctx.clientId)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Too many clients connected to this code',
        });
      }

      return true;
    }),

  search: navigatorGameProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 10,
        per: 'minute',
      }),
    )
    .input(
      z.object({
        type: z.nativeEnum(PoiType),
        scope: z.nativeEnum(ScopeType),
        center: z.optional(z.array(z.number()).length(2)),
      }),
    )
    .query<SearchResultWithRelativeTruckInfo[]>(async ({ input, ctx }) => {
      const { readTelemetry, readActiveRoute, gameContext } = ctx.sessionActor;
      const { type: poiType, scope } = input;
      const addRelativeTruckInfo = createWithRelativeTruckInfoMapper(
        gameContext.map,
        readTelemetry,
      );

      let searchRequest: SearchRequest;
      if (input.scope === ScopeType.NEARBY && input.center) {
        const toGameCoords =
          gameContext.map === 'usa'
            ? fromWgs84ToAtsCoords
            : fromWgs84ToEts2Coords;
        searchRequest = {
          scope: ScopeType.NEARBY,
          poiType: input.type,
          point: toGameCoords(input.center as [number, number]),
        };
      } else {
        searchRequest = createSearchRequest(scope, poiType, {
          readTelemetry,
          readActiveRoute,
        });
      }

      return (await ctx.services.search.searchPoi(searchRequest, gameContext))
        .slice(0, scope === ScopeType.NEARBY ? maxSearchResults : Infinity)
        .map(addRelativeTruckInfo);
    }),
  getAutocompleteOptions: navigatorGameProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 4,
        per: 'second',
      }),
    )
    .input(z.string().max(100))
    .query<SearchResultWithRelativeTruckInfo[]>(async ({ input, ctx }) => {
      const { readTelemetry, gameContext } = ctx.sessionActor;
      const currentTruckLocation = readTelemetry()?.truck.position;
      const toLngLat =
        gameContext.map === 'usa'
          ? fromAtsCoordsToWgs84
          : fromEts2CoordsToWgs84;
      const results = await ctx.services.search.search(
        input,
        maxSearchResults,
        {
          game: gameContext,
          truckLngLat: currentTruckLocation
            ? toLngLat([currentTruckLocation.X, currentTruckLocation.Z])
            : undefined,
          activeJob: ctx.sessionActor.readJobState(),
          activeRoute: ctx.sessionActor.readActiveRoute(),
        },
      );
      const addRelativeTruckInfo = createWithRelativeTruckInfoMapper(
        gameContext.map,
        readTelemetry,
      );

      return results.map(addRelativeTruckInfo);
    }),
  synthesizeSearchResult: navigatorSessionProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 1,
        per: 'second',
      }),
    )
    .input(z.array(z.number()).length(2)) // [lon, lat]
    .query<SearchResult>(({ input, ctx }) => {
      return ctx.services.search.synthesizeSearchResult(
        input as [number, number],
        assertExists(
          ctx.sessionActor.gameContext,
          'GameContext must exist in order to synthesize a search result.',
        ),
      );
    }),
  previewRoutes: navigatorGameProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 1,
        per: 'second',
      }),
    )
    .input(
      z.object({
        toNodeUid: z.string().max(16),
      }),
    )
    .query<RouteWithSummary[]>(async ({ input, ctx }) => {
      const { readActiveRoute, readTelemetry, readRouteIndex, gameContext } =
        ctx.sessionActor;
      const { lookups, domainEventSink, routing } = ctx.services;
      const toNodeUid = BigInt('0x' + input.toNodeUid);
      const truck = Preconditions.checkExists(readTelemetry()).truck;
      const { graphAndMapData } = lookups.getData(gameContext);

      return computePreviewRoutes(
        toNodeUid,
        { activeRoute: readActiveRoute(), routeIndex: readRouteIndex(), truck },
        { graphAndMapData, routing, domainEventSink },
      );
    }),
  generateRouteFromNodeUids: navigatorGameProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 1,
        per: 'second',
      }),
    )
    .input(
      z
        .array(z.string().regex(/^[0-9a-f]{1,16}$/i))
        .min(1)
        .max(50),
    )
    .query<Route>(async ({ input, ctx }) => {
      const { lookups, routing, domainEventSink } = ctx.services;
      const { readActiveRoute, readTelemetry, gameContext } = ctx.sessionActor;
      const { graphAndMapData } = lookups.getData(gameContext);
      const truck = Preconditions.checkExists(readTelemetry()).truck;
      const nodeUids = input.map(v => BigInt('0x' + v));
      const strategy = readActiveRoute()?.segments[0].strategy ?? 'fastest';

      const { lookup, ...route } = await buildRouteFromNodeUids(
        nodeUids,
        strategy,
        truck,
        { graphAndMapData, routing, domainEventSink },
      );
      return route;
    }),
  setActiveRoute: navigatorGameProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 5,
        per: 'minute',
      }),
    )
    .input(z.optional(z.array(z.string().refine(isRouteKey)).max(50)))
    .mutation(async ({ input, ctx }) => {
      const { lookups, routing } = ctx.services;
      const { setActiveRoute, gameContext } = ctx.sessionActor;
      const graphAndMapData = lookups.getData(gameContext).graphAndMapData;

      if (input == null) {
        setActiveRoute(undefined);
      } else {
        setActiveRoute(
          await generateRouteFromKeys(input as RouteKey[], {
            graphAndMapData,
            routing,
          }),
        );
      }
    }),
  unpauseRouteEvents: navigatorSessionProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 5,
        per: 'minute',
      }),
    )
    .mutation(({ ctx }) => {
      const { unpauseRouteEvents } = ctx.sessionActor;
      unpauseRouteEvents();
    }),
  subscribeToDevice: navigatorSessionProcedure
    .use(subscriptionLimitMiddleware(2))
    .subscription(async function* ({
      path,
      ctx,
      signal,
    }): AsyncGenerator<ActorEvent, void, void> {
      assert(ctx.auth.state === AuthState.VIEWER_AUTHENTICATED);
      const telemetryId = await ctx.services.kv.get(
        navigatorKeys.viewerId(ctx.auth.viewerId),
      );
      if (telemetryId == null) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'unknown viewer id',
        });
      }

      const { generator, unsubscribe } = subscribeSession(
        ctx.sessionActor,
        signal,
        ctx.services.lookups,
      );
      // If no positionUpdate has arrived within this window — at subscribe
      // time or during an active session — emit a staleBinding event so the
      // webapp can prompt the user to re-pair. Catches the scenario where
      // the desktop client was re-paired and minted a new telemetryId while
      // the webapp's viewerId still pointed at the old (dead) actor.
      // The webapp surfaces this as a passive UI prompt (try again /
      // re-pair) rather than auto-clearing credentials, so it's safe to
      // fire fairly eagerly: a user who's still booting the game knows to
      // ignore the prompt and wait it out.
      const stalePositionTimeoutMs = 10_000;
      let lastPositionAt = Date.now();
      try {
        while (true) {
          // touch actor to keep it alive and prevent it from being swept.
          ctx.services.sessionActors.get(telemetryId);

          const elapsed = Date.now() - lastPositionAt;
          const remaining = Math.max(0, stalePositionTimeoutMs - elapsed);

          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          const timedOut = new Promise<'timeout'>(resolve => {
            timeoutId = setTimeout(() => resolve('timeout'), remaining);
          });

          let res: 'timeout' | Awaited<ReturnType<typeof generator.next>>;
          try {
            res = await Promise.race([generator.next(), timedOut]);
          } finally {
            if (timeoutId !== undefined) clearTimeout(timeoutId);
          }

          if (res === 'timeout') {
            yield { type: 'staleBinding' };
            return;
          }

          if (res.done) {
            break;
          }
          if (res.value.type === 'positionUpdate') {
            lastPositionAt = Date.now();
          }
          yield res.value;
        }
      } catch (err) {
        logger.error('actor subscription error', {
          trpc: {
            path,
            type: 'subscription',
          },
          request: {
            type: ctx.type,
            clientId: ctx.clientId,
          },
          error:
            err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
      } finally {
        unsubscribe();
      }
    }),
  /** @deprecated use `subscribeToDevice` instead */
  onPositionUpdate: navigatorSessionProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 5,
        per: 'minute',
      }),
    )
    .use(subscriptionLimitMiddleware(3))
    .subscription(({ ctx }) =>
      observable<GameState>(emit => {
        const { telemetryEventEmitter } = ctx.sessionActor;
        const onPositionUpdate = (telemetry: TruckSimTelemetry) =>
          emit.next(toGameState(telemetry));
        telemetryEventEmitter.on('telemetry', onPositionUpdate);
        return () => telemetryEventEmitter.off('telemetry', onPositionUpdate);
      }),
    ),
});
