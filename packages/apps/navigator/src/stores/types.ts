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

export interface SessionStore {
  themeMode: 'light' | 'dark';
  map: 'usa' | 'europe';
  hasReceivedFirstTelemetry: boolean;
  readyToLoad: boolean;
  bindingStale: boolean;
}

export interface CameraStore {
  cameraMode: CameraMode;
  bearingMode: BearingMode;
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

  pushPage(key: NavPageKey): void;
  popPage(): void;
  replaceTopPage(key: NavPageKey): void;
  resetStack(initial?: NavPageKey): void;

  isLoading: boolean;
  disableFitToBounds: boolean;

  searchQuery: string;
  destinations: SearchResultWithRelativeTruckInfo[];
  selectedDestination: SearchResult | undefined;

  routes: RouteWithSummary[];
  selectedRoute: Route | undefined;
}
