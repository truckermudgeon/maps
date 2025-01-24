import type { CreateTRPCProxyClient } from '@trpc/client';
import type { AppRouter } from '@truckermudgeon/navigation';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import type {
  Route,
  RouteDirection,
  SearchResult,
} from '@truckermudgeon/navigation/types';
import type { Marker } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import type { CameraMode, NavPageKey } from './constants';

export type AppClient = CreateTRPCProxyClient<AppRouter>;

export interface AppStore {
  cameraMode: CameraMode;
  activeRoute: Route | undefined;
  activeRouteDirection: RouteDirection | undefined;
  trailerPoint: [lon: number, lat: number] | undefined;
  showNavSheet: boolean;
}

export interface AppController {
  onMapLoad(map: MapRef, playerMarker: Marker): void;
  onMapDragStart(store: AppStore): void;

  setFollow(store: AppStore): void;
  startRouteFlow(store: AppStore): void;
}

export type Direction = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export interface ControlsStore {
  direction: Direction;
  limitMph: number;
  showRecenterFab: boolean;
  showRouteFab: boolean;
  showSearchFab: boolean;
}

export interface ControlsController {
  startListening(store: ControlsStore, socket: AppClient): void;
}

// TODO clean this data up. Some fields can probably be inferred.
export interface NavSheetStore extends DestinationsStore {
  readonly title: string;
  currentPageKey: NavPageKey;
  readonly showBackButton: boolean;

  isLoading: boolean;
  selectedDestinationType: PoiType | undefined;

  destinations: SearchResult[];
  selectedDestination: SearchResult | undefined;

  routes: Route[];
  selectedRoute: Route | undefined;
}

export interface DestinationsStore {
  destinations: SearchResult[];
  selectedDestination: SearchResult | undefined;
  currentPageKey: NavPageKey;
}

export interface NavSheetController {
  onBackClick(store: NavSheetStore): void;
  onDestinationTypeClick(store: NavSheetStore, type: PoiType): void;

  onDestinationHighlight(store: NavSheetStore, destination: SearchResult): void;
  onDestinationGoClick(store: NavSheetStore, destination: SearchResult): void;
  onDestinationRoutesClick(
    store: NavSheetStore,
    destination: SearchResult,
  ): void;

  onRouteHighlight(store: NavSheetStore, route: Route): void;
  onRouteGoClick(store: NavSheetStore, route: Route): void;

  reset(store: NavSheetStore): void;
}
