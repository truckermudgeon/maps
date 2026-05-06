import type { createTRPCProxyClient } from '@trpc/client';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import type {
  AppRouter,
  Route,
  SearchResult,
} from '@truckermudgeon/navigation/types';
import type { Marker } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import type {
  CameraStore,
  NavSheetStore,
  RouteStore,
  SessionStore,
} from '../stores/types';

export type { NavSheetStore } from '../stores/types';

export type AppClient = ReturnType<
  typeof createTRPCProxyClient<AppRouter>
>['app'];

export interface AppStore extends SessionStore, CameraStore, RouteStore {
  showNavSheet: boolean;
}

export interface AppController {
  onMapLoad(map: MapRef, playerMarker: Marker): void;

  setFree(store: AppStore): void;
  setFollow(store: AppStore): void;

  addMapDragEndListener(
    cb: (centerLngLat: [number, number]) => void,
  ): () => void;
}

export type CompassPoint = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export interface ControlsStore {
  // (-180, 180] CW, 0 is north.
  bearing: number;
  limit: number;
  speed: number;
  readonly units: 'imperial' | 'metric';
  readonly showRecenterFab: boolean;
  readonly showRouteFab: boolean;
  readonly showSearchFab: boolean;
}

export interface ControlsController {
  startListening(store: ControlsStore, appClient: AppClient): void;
  onMapLoad(store: ControlsStore, map: MapRef): void;
}

export interface NavSheetController {
  search(store: NavSheetStore, query: string): Promise<SearchResult[]>;
  onSearchSelect(
    store: NavSheetStore,
    queryOrResult: string | SearchResult,
  ): void;

  onBackClick(store: NavSheetStore): void;

  onChooseOnMapClick(store: NavSheetStore): void;
  onDestinationTypeClick(
    store: NavSheetStore,
    type: PoiType,
    label: string,
    appController: AppController,
  ): void;

  onDestinationHighlight(store: NavSheetStore, destination: SearchResult): void;
  onDestinationGoClick(store: NavSheetStore, destination: SearchResult): void;
  onDestinationRoutesClick(
    store: NavSheetStore,
    destination: SearchResult,
  ): void;

  onRouteHighlight(store: NavSheetStore, route: Route): void;
  onRouteDetailsClick(store: NavSheetStore, route: Route): void;
  onRouteGoClick(store: NavSheetStore, route: Route): void;

  reset(store: NavSheetStore): void;

  startChooseDestinationFlow(navSheetStore: NavSheetStore): void;
  startSearchAlongFlow(navSheetStore: NavSheetStore): void;
  startShowActiveRouteDirectionsFlow(navSheetStore: NavSheetStore): void;
  startManageStopsFlow(navSheetStore: NavSheetStore): void;
}

export interface Breakpoints {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
}

export interface UIEnvironmentStore {
  readonly breakpoints: Breakpoints;
  readonly width: number;
  readonly height: number;
  readonly orientation: 'portrait' | 'landscape';
  readonly isLargePortrait: boolean;

  // other potential fields
  // isTouchMobile;
  // isDesktopPointer;
  // isKeyboardOpen;
}

export interface MapPaddingStore {
  readonly padding: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
  readonly offset: [number, number];
}
