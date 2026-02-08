import { observable } from '@trpc/server/observable';
import { z } from 'zod';
import { PoiType, ScopeType } from '../../constants';
import type {
  ActorEvent,
  GameState,
  Route,
  RouteWithSummary,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
} from '../../types';
import { publicProcedure, router } from '../init';

const navigatorProcedure = publicProcedure;
const navigatorSessionProcedure = navigatorProcedure;

export const navigatorRouter = router({
  redeemCode: navigatorProcedure
    .input(z.object({ code: z.string().length(4) }))
    .mutation<{
      viewerId: string;
      telemetryId: string;
    }>(async ({ ctx, input }) => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  reconnect: navigatorProcedure
    .input(z.object({ viewerId: z.string().length(36) }))
    .mutation<boolean>(async ({ path, ctx, input }) => {
      console.log(path, ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),

  search: navigatorSessionProcedure
    .input(
      z.object({
        type: z.nativeEnum(PoiType),
        scope: z.nativeEnum(ScopeType),
        center: z.optional(z.array(z.number()).length(2)),
      }),
    )
    .query<SearchResultWithRelativeTruckInfo[]>(async ({ input, ctx }) => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  getAutocompleteOptions: navigatorSessionProcedure
    .input(z.string().max(100))
    .query<SearchResultWithRelativeTruckInfo[]>(async ({ input, ctx }) => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  synthesizeSearchResult: navigatorSessionProcedure
    .input(z.array(z.number()).length(2)) // [lon, lat]
    .query<SearchResult>(({ input, ctx }) => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  previewRoutes: navigatorSessionProcedure
    .input(
      z.object({
        toNodeUid: z.string().max(16),
      }),
    )
    .query<RouteWithSummary[]>(async ({ input, ctx }) => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  generateRouteFromNodeUids: navigatorSessionProcedure
    .input(z.array(z.string().max(16)).min(1).max(50))
    .query<Route>(async ({ input, ctx }) => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  setActiveRoute: navigatorSessionProcedure
    .input(z.optional(z.array(z.string().max(100)).min(1).max(50)))
    .mutation(async ({ input, ctx }) => {
      console.log(ctx, input);
      return Promise.reject(new Error('unimplemented'));
    }),
  unpauseRouteEvents: navigatorSessionProcedure.mutation<void>(({ ctx }) => {
    console.log(ctx);
    return Promise.reject(new Error('unimplemented'));
  }),
  subscribeToDevice: navigatorSessionProcedure.subscription(async function* ({
    ctx,
    signal,
  }): AsyncGenerator<ActorEvent, void, void> {
    console.log(ctx, signal);
    yield Promise.reject(new Error('unimplemented'));
  }),
  /** @deprecated use `subscribeToDevice` instead */
  onPositionUpdate: navigatorSessionProcedure.subscription(({ ctx }) =>
    observable<GameState>(emit => {
      console.log(ctx, emit);
      return () => void 0;
    }),
  ),
});
