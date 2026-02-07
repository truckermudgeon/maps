import type { createTRPCProxyClient } from '@trpc/client';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import type {
  AppRouter,
  Route,
  RouteIndex,
  RouteStep,
  RouteWithSummary,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
  SegmentInfo,
  StepManeuver,
} from '@truckermudgeon/navigation/types';
import type { Marker } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import type { CameraMode, NavPageKey } from './constants';

export type AppClient = ReturnType<
  typeof createTRPCProxyClient<AppRouter>
>['app'];

export interface AppStore {
  themeMode: 'light' | 'dark';
  cameraMode: CameraMode;
  truckPoint: readonly [lon: number, lat: number];
  trailerPoint: readonly [lon: number, lat: number] | undefined;
  showNavSheet: boolean;
  isReceivingTelemetry: boolean;

  // TODO naming.
  activeRoute: Route | undefined;
  activeRouteIndex: RouteIndex | undefined;
  // total route
  activeRouteSummary: { distanceMeters: number; minutes: number } | undefined;
  // to first waypoint
  activeRouteToFirstWayPointSummary:
    | { distanceMeters: number; minutes: number }
    | undefined;

  segmentComplete: SegmentInfo | undefined;

  readonly distanceToNextManeuver: number | undefined;
  readonly activeRouteDirection: StepManeuver | undefined;
  readonly activeArrowStep: RouteStep | undefined;
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
  readonly currentPageKey: NavPageKey;
  readonly showBackButton: boolean;
  readonly pageStack: NavPageKey[];

  isLoading: boolean;
  disableFitToBounds: boolean;

  searchQuery: string;
  destinations: SearchResultWithRelativeTruckInfo[];
  selectedDestination: SearchResult | undefined;

  routes: RouteWithSummary[];
  selectedRoute: Route | undefined;
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
