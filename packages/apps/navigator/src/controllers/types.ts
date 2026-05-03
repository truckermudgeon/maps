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
import type { BearingMode, CameraMode, NavPageKey } from './constants';

export type AppClient = ReturnType<
  typeof createTRPCProxyClient<AppRouter>
>['app'];

export interface AppStore {
  themeMode: 'light' | 'dark';
  map: 'usa' | 'europe';
  cameraMode: CameraMode;
  bearingMode: BearingMode;
  truckPoint: readonly [lon: number, lat: number];
  trailerPoint: readonly [lon: number, lat: number] | undefined;
  showNavSheet: boolean;
  // true once the webapp has received its first positionUpdate from the
  // server; never flipped back. Used to gate the initial "Waiting for
  // telemetry" overlay. For mid-session loss-of-telemetry, see bindingStale.
  hasReceivedFirstTelemetry: boolean;
  readyToLoad: boolean;
  // true once the server has signaled that no telemetry has arrived within
  // its grace window. The UI uses this to surface a "try again / re-pair"
  // prompt instead of leaving the user staring at the spinner.
  bindingStale: boolean;

  // TODO naming.
  activeRoute: Route | undefined;
  activeRouteIndex: RouteIndex | undefined;

  segmentComplete: SegmentInfo | undefined;

  // total route
  readonly activeRouteSummary:
    | { distanceMeters: number; minutes: number }
    | undefined;
  // to first waypoint
  readonly activeRouteToFirstWayPointSummary:
    | { distanceMeters: number; minutes: number }
    | undefined;
  readonly distanceToNextManeuver: number;
  readonly activeRouteDirection: StepManeuver | undefined;
  readonly activeStepLine:
    | { line: GeoJSON.Feature<GeoJSON.LineString>; length: number }
    | undefined;
  readonly activeArrowStep: RouteStep | undefined;
  readonly geoJsonRoute: {
    steps: readonly { step: RouteStep; featureLength: number }[];
    featureLength: number;
  };
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
  startListening(store: ControlsStore, appClient: AppClient, map: MapRef): void;
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
