import type { createTRPCProxyClient } from '@trpc/client';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import type {
  AppRouter,
  Route,
  SearchResult,
} from '@truckermudgeon/navigation/types';

export type { NavSheetStore } from '../stores/types';

export type AppClient = ReturnType<
  typeof createTRPCProxyClient<AppRouter>
>['app'];

export interface AppController {
  forceRePair(): void;
  setDestinationNodeUid(toNodeUid: string): void;
  setActiveRoute(route: Route | undefined): void;
  setActiveRouteFromNodeUids(waypoints: bigint[]): void;
  synthesizeSearchResult(): Promise<SearchResult>;
  unpauseRouteEvents(): void;
}

export interface NavSheetController {
  search(query: string): Promise<SearchResult[]>;
  onSearchSelect(queryOrResult: string | SearchResult): void;

  onBackClick(): void;

  onDestinationTypeClick(type: PoiType, label: string): void;

  onDestinationRoutesClick(destination: SearchResult): void;
}
