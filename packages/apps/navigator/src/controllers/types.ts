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
  themeMode: 'light' | 'dark';
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

export type CompassPoint = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export interface ControlsStore {
  direction: CompassPoint;
  limitMph: number;
  speedMph: number;
  showRecenterFab: boolean;
  showRouteFab: boolean;
  showSearchFab: boolean;
}

export interface ControlsController {
  startListening(store: ControlsStore, appClient: AppClient): void;
}

// TODO clean this data up. Some fields can probably be inferred.
export interface NavSheetStore {
  readonly title: string;
  currentPageKey: NavPageKey;
  readonly showBackButton: boolean;

  isLoading: boolean;
  selectedPoiTypeLabel: string | undefined;

  destinations: SearchResult[];
  selectedDestination: SearchResult | undefined;

  routes: Route[];
  selectedRoute: Route | undefined;
}

export interface NavSheetController {
  onBackClick(store: NavSheetStore): void;
  onDestinationTypeClick(
    store: NavSheetStore,
    type: PoiType,
    label: string,
  ): void;

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
