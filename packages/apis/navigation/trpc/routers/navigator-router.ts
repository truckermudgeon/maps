import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { assert, assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';
import {
  fromAtsCoordsToWgs84,
  fromWgs84ToAtsCoords,
} from '@truckermudgeon/map/projections';
import crypto from 'node:crypto';
import { z } from 'zod';
import { PoiType, ScopeType } from '../../constants';
import { toGameState } from '../../domain/actor/game-state';
import type { RouteWithLookup } from '../../domain/actor/generate-routes';
import {
  addWaypoint,
  generateRouteFromKeys,
  generateRoutes,
} from '../../domain/actor/generate-routes';
import { generateSummary } from '../../domain/actor/generate-summary';
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

  search: navigatorSessionProcedure
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
      console.log('search request', input);
      const { readTelemetry, readActiveRoute } = ctx.sessionActor;
      const { type: poiType, scope } = input;
      const addRelativeTruckInfo = createWithRelativeTruckInfoMapper(
        'usa',
        readTelemetry,
      );

      let searchRequest: SearchRequest;
      if (input.scope === ScopeType.NEARBY && input.center) {
        searchRequest = {
          scope: ScopeType.NEARBY,
          poiType: input.type,
          point: fromWgs84ToAtsCoords(input.center as [number, number]),
        };
      } else {
        searchRequest = createSearchRequest(scope, poiType, {
          readTelemetry,
          readActiveRoute,
        });
      }

      return (await ctx.services.search.searchPoi(searchRequest))
        .slice(0, scope === ScopeType.NEARBY ? maxSearchResults : Infinity)
        .map(addRelativeTruckInfo);
    }),
  getAutocompleteOptions: navigatorSessionProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 4,
        per: 'second',
      }),
    )
    .input(z.string().max(100))
    .query<SearchResultWithRelativeTruckInfo[]>(async ({ input, ctx }) => {
      const { readTelemetry } = ctx.sessionActor;
      const currentTruckLocation = readTelemetry()?.truck.position;
      const results = await ctx.services.search.search(
        input,
        maxSearchResults,
        {
          truckLngLat: currentTruckLocation
            ? fromAtsCoordsToWgs84([
                currentTruckLocation.X,
                currentTruckLocation.Z,
              ])
            : undefined,
          activeJob: ctx.sessionActor.readJobState(),
          activeRoute: ctx.sessionActor.readActiveRoute(),
        },
      );
      const addRelativeTruckInfo = createWithRelativeTruckInfoMapper(
        'usa',
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
      );
    }),
  previewRoutes: navigatorSessionProcedure
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
      const {
        lookups: { graphAndMapData },
        domainEventSink,
        routing,
      } = ctx.services;
      const { readActiveRoute, readTelemetry, readRouteIndex } =
        ctx.sessionActor;
      const toNodeUid = BigInt('0x' + input.toNodeUid);
      const activeRoute = readActiveRoute();
      const truck = Preconditions.checkExists(readTelemetry()).truck;

      const routesWithLookup: RouteWithLookup[] = [];
      if (!activeRoute) {
        routesWithLookup.push(
          ...(await generateRoutes(
            toNodeUid,
            ['smallRoads', 'shortest', 'fastest'],
            {
              graphAndMapData,
              routing,
              truck,
              domainEventSink,
            },
          )),
        );
      } else {
        const withWaypoint = await addWaypoint(toNodeUid, activeRoute, 'auto', {
          graphAndMapData,
          routing,
          routeIndex: assertExists(readRouteIndex()),
          truck: Preconditions.checkExists(readTelemetry()).truck,
          domainEventSink,
        });
        routesWithLookup.push(withWaypoint);
      }

      const routes = routesWithLookup.map(rwl => {
        const { lookup, ...route } = rwl;
        return {
          ...route,
          // TODO
          summary: generateSummary(rwl, graphAndMapData),
        };
      });
      // HACK look into deep equal libs?
      const uniqueRoutes = new Map<string, RouteWithSummary>(
        routes.map(route => {
          const segmentsAsString = route.segments
            .flatMap(segment => segment.steps.flatMap(step => step.geometry))
            .join();
          return [segmentsAsString, route];
        }),
      );
      return [...uniqueRoutes.values()].reverse();
    }),
  generateRouteFromNodeUids: navigatorSessionProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 1,
        per: 'second',
      }),
    )
    .input(z.array(z.string().max(16)).min(1).max(50))
    .query<Route>(async ({ input, ctx }) => {
      // TODO precon failures should throw 400s.
      Preconditions.checkArgument(input.length > 0);
      const {
        lookups: { graphAndMapData },
        routing,
        domainEventSink,
      } = ctx.services;
      const { readActiveRoute, readTelemetry } = ctx.sessionActor;

      const truck = Preconditions.checkExists(readTelemetry()).truck;
      const nodeUids = input.map(v => BigInt('0x' + v));
      const lastNodeUid = nodeUids.pop()!;

      const routeToEnd = (
        await generateRoutes(
          lastNodeUid,
          [readActiveRoute()?.segments[0].strategy ?? 'fastest'],
          { graphAndMapData, routing, truck, domainEventSink },
        )
      )[0];
      if (!routeToEnd) {
        throw new Error('no route to endpoint ' + lastNodeUid.toString(16));
      }

      let finalRoute = routeToEnd;
      for (const waypoint of nodeUids) {
        finalRoute = await addWaypoint(waypoint, finalRoute, 'last', {
          graphAndMapData,
          routing,
          truck,
          routeIndex: { segmentIndex: 0, stepIndex: 0, nodeIndex: 0 },
          domainEventSink,
        });
      }

      const { lookup, ...route } = finalRoute;
      return route;
    }),
  setActiveRoute: navigatorSessionProcedure
    .use(
      rateLimitMiddleware({
        maxCalls: 5,
        per: 'minute',
      }),
    )
    .input(z.optional(z.array(z.string().max(100)).min(1).max(50)))
    .mutation(async ({ input, ctx }) => {
      const {
        lookups: { graphAndMapData },
        routing,
      } = ctx.services;
      const { setActiveRoute, readActiveRoute } = ctx.sessionActor;

      if (input == null) {
        console.log('clearing active route');
        setActiveRoute(undefined);
      } else {
        console.log('generating and setting active route');
        setActiveRoute(
          await generateRouteFromKeys(input, { graphAndMapData, routing }),
        );
        console.log('active route set:', readActiveRoute()?.id);
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
    .use(subscriptionLimitMiddleware(1))
    .subscription(async function* ({
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

      const generator = subscribeSession(
        ctx.sessionActor,
        signal,
        ctx.services.lookups.graphAndMapData.tsMapData,
      )();
      while (true) {
        // touch actor to keep it alive and prevent it from being swept.
        ctx.services.sessionActors.get(telemetryId);
        const res = await generator.next();
        if (!res.done) {
          yield res.value;
        }
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
    .use(subscriptionLimitMiddleware(2))
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
