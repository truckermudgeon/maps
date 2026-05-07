import type { createTRPCProxyClient } from '@trpc/client';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import type { AppRouter, SearchResult } from '@truckermudgeon/navigation/types';
import type { MapPresenter } from '../services/map-presenter';
import type { CameraStore, RouteStore, SessionStore } from '../stores/types';

export type { NavSheetStore } from '../stores/types';

export type AppClient = ReturnType<
  typeof createTRPCProxyClient<AppRouter>
>['app'];

export interface AppStore extends SessionStore, CameraStore, RouteStore {}

export type CompassPoint = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export interface NavSheetController {
  search(query: string): Promise<SearchResult[]>;
  onSearchSelect(queryOrResult: string | SearchResult): void;

  onBackClick(): void;

  onDestinationTypeClick(
    type: PoiType,
    label: string,
    mapPresenter: MapPresenter,
  ): void;

  onDestinationRoutesClick(destination: SearchResult): void;
}
