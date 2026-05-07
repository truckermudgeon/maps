import type {
  Route,
  RouteIndex,
  RouteStep,
  RouteWithSummary,
  SearchResult,
  SearchResultWithRelativeTruckInfo,
  SegmentInfo,
  StepManeuver,
} from '@truckermudgeon/navigation/types';
import type {
  BearingMode,
  CameraMode,
  NavPageKey,
} from '../controllers/constants';

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

/**
 * Two orthogonal telemetry flags (`hasReceivedFirstTelemetry` and
 * `bindingStale`) collapse into one of these four states:
 *
 *   !first && !stale → awaiting (initial connect, no data yet)
 *   !first &&  stale → orphaned (server said no binding before any data)
 *    first && !stale → live     (steady-state)
 *    first &&  stale → lost     (mid-session: subscription dropped)
 */
export type TelemetryStatus = 'awaiting' | 'orphaned' | 'live' | 'lost';

export interface SessionStore {
  themeMode: 'light' | 'dark';
  map: 'usa' | 'europe';
  hasReceivedFirstTelemetry: boolean;
  isAuthenticated: boolean;
  bindingStale: boolean;
  readonly telemetryStatus: TelemetryStatus;
}

export interface CameraStore {
  cameraMode: CameraMode;
  bearingMode: BearingMode;
  setFollow(): void;
  setFree(): void;
  setNorthLock(): void;
  setNorthUnlock(): void;
}

export interface ActiveStepLine {
  line: GeoJSON.Feature<GeoJSON.LineString>;
  length: number;
  arrow?: {
    geometry: GeoJSON.Feature<GeoJSON.LineString>;
    length: number;
  };
}

export interface RouteSummary {
  distanceMeters: number;
  minutes: number;
}

export interface RouteStore {
  activeRoute: Route | undefined;
  activeRouteIndex: RouteIndex | undefined;
  truckPoint: readonly [lon: number, lat: number];
  trailerPoint: readonly [lon: number, lat: number] | undefined;
  segmentComplete: SegmentInfo | undefined;

  readonly activeRouteSummary: RouteSummary | undefined;
  readonly activeRouteToFirstWayPointSummary: RouteSummary | undefined;
  readonly distanceToNextManeuver: number;
  readonly activeRouteDirection: StepManeuver | undefined;
  readonly activeStepLine: ActiveStepLine | undefined;
  readonly activeArrowStep: RouteStep | undefined;
  readonly geoJsonRoute: {
    steps: readonly { step: RouteStep; featureLength: number }[];
    featureLength: number;
  };
}

export interface NavSheetStore {
  readonly title: string;
  readonly currentPageKey: NavPageKey;
  readonly showBackButton: boolean;
  readonly pageStack: readonly NavPageKey[];

  // Page-stack mutations.
  pushPage(key: NavPageKey): void;
  popPage(): void;
  replaceTopPage(key: NavPageKey): void;
  resetStack(initial?: NavPageKey): void;

  // Flow / selection mutations.
  reset(initialPage?: NavPageKey): void;
  startChooseDestinationFlow(): void;
  startSearchAlongFlow(): void;
  startShowActiveRouteDirectionsFlow(): void;
  startManageStopsFlow(): void;
  highlightDestination(dest: SearchResult): void;
  selectDestination(dest: SearchResult): void;
  openChooseOnMap(): void;
  highlightRoute(route: Route): void;
  selectRoute(route: Route): void;
  showRouteDetails(route: Route): void;

  showNavSheet: boolean;
  isLoading: boolean;
  disableFitToBounds: boolean;

  searchQuery: string;
  destinations: SearchResultWithRelativeTruckInfo[];
  selectedDestination: SearchResult | undefined;

  routes: RouteWithSummary[];
  selectedRoute: Route | undefined;
}
