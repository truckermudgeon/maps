import type { Mode } from '@truckermudgeon/map/routing';
import type { SearchProperties } from '@truckermudgeon/map/types';
import type { z } from 'zod';
import type { BranchType } from './constants';
import type {
  JobLocationSchema,
  SpeedSchema,
  TruckSimTelemetrySchema,
} from './domain/schemas';
import type { appRouter } from './trpc/router';

export type AppRouter = typeof appRouter;

export interface StepManeuver {
  direction: BranchType;
  /**
   * The coordinates at which the maneuver takes place. E.g., a right turn's
   * `lonLat` could be at the center of an intersection.
   */
  lonLat: [number, number];
  // for 'depart':
  // - show a straight line arrow, with a dashed stem
  // - show "Head west [toward Main St]"
  // - show a thenHint for the next RouteDirection's maneuver
  //
  // for 'arrive':
  // - show a map marker icon to indicate destination point
  // - show name of destination (company name, facility type)
  banner?: {
    icon?: string;
    text?: string;
  };
  laneHint?: LaneHint;
  thenHint?: ThenHint;
}

interface LaneHint {
  lanes: {
    branches: BranchType[];
    activeBranch?: BranchType;
  }[];
}

interface ThenHint {
  direction: BranchType;
}

export type SearchResult = SearchProperties & {
  id: number;
  nodeUid: string;
  lonLat: [number, number];
  facilityUrls: string[];
};

export type SearchResultWithRelativeTruckInfo = SearchResult & {
  distance: number;
  bearing: number;
};

/**
 * A step along a route. Includes a step maneuver and information about travel
 * to the following route step.
 */
export interface RouteStep {
  maneuver: StepManeuver;
  // the full route geometry, in polyline lonlats, in map space, from this route
  // step to the next route step. examples in game terms:
  //   - if starting a route from a road: the geometry of the road, up to
  //     the point it connects to an intersection prefab
  //   - if starting a route from an intersection prefab: the geometry of
  //     the nav curve from start node to end node, plus the geometry of the
  //     following road, up to the point the road connects to the next
  //     intersection prefab.
  geometry: string;
  /** The distance traveled from the maneuver to the next route step. */
  distanceMeters: number;
  /** The estimated time, in seconds, to travel to the next route step. */
  duration: number;
  /**
   * The number of nodes traveled, excluding the starting node of the next
   * route step.
   */
  nodesTraveled: number;
  /**
   * The number of points in `geometry` to use to draw an arrow for the step.
   */
  arrowPoints?: number;
  trafficIcons: {
    type: 'stop' | 'trafficLight';
    // in map space
    lonLat: [number, number];
  }[];
}

export interface RouteSegment {
  key: string;
  steps: RouteStep[]; // must have length > 0
  strategy: Mode;
  /** Sum of steps' distances */
  distanceMeters: number;
  /** Sum of steps' durations, in seconds. */
  duration: number;
  score: number;
}

export interface Route {
  id: string;
  segments: RouteSegment[];
  /** Sum of segments' distances */
  distanceMeters: number;
  /** Sum of segments' durations, in seconds. */
  duration: number;
  detour?: {
    /** Additional distance this route has over a base Route */
    distanceMeters: number;
    /** Additional duration this route has over a base Route */
    duration: number;
    /** Position of detour */
    lngLat: [number, number];
  };
}

export interface RouteGrade {
  flatIndexStart: number;
  flatIndexEnd: number;
  /** [0, 100] */
  percentage: number;
  range: number;
  distance: number;
}

export interface RouteSummary {
  grades: RouteGrade[];
  roads: string[];
  hasTolls: boolean;
}

export type RouteWithSummary = Route & { summary: RouteSummary };

export type ActorEvent =
  // state updates
  | {
      type: 'positionUpdate';
      data: GameState;
    }
  | {
      type: 'routeUpdate';
      data: Route | undefined;
    }
  | {
      type: 'themeModeUpdate';
      data: 'light' | 'dark';
    }
  | {
      type: 'trailerUpdate';
      data: TrailerState | undefined;
    }
  | {
      type: 'jobUpdate';
      data: JobState | undefined;
    }
  // events
  | {
      type: 'routeProgress';
      data: RouteIndex | undefined;
    }
  | {
      type: 'segmentComplete';
      data: SegmentInfo;
    };

export interface TrailerState {
  attached: false;
  position: [lon: number, lat: number];
}

export interface JobState {
  source: JobLocation;
  destination: JobLocation;
  toNodeUid: string;
  countryCode: string;
  countryName: string;
}

// --- Telemetry sample ---

export interface TelemetrySample {
  t: number; // telemetry time (milliseconds), monotonic non-decreasing
  paused: boolean;
  position: { x: number; y: number; z: number }; // ESU meters
  heading: number; // radians, 0 = north, CCW
  speed: number; // m/s
  linearAccel: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number }; // no idea
  angularAccel: { x: number; y: number; z: number };
}

export interface GameState extends TelemetrySample {
  // world stuff
  speedLimit: number;
  scale: number;
}

export interface SegmentInfo {
  place: string;
  placeInfo: string;
  isFinal: boolean;
}

export type Speed = z.infer<typeof SpeedSchema>;

export type JobLocation = z.infer<typeof JobLocationSchema>;

export type TruckSimTelemetry = z.infer<typeof TruckSimTelemetrySchema>;
/** An index to a node within a `Route`. */
export interface RouteIndex {
  /** index into `Route.segments` */
  segmentIndex: number;
  /** index into `RouteSegment.steps` */
  stepIndex: number;
  /**
   * The index of a node within `RouteStep`.
   * Range is [0, `RouteStep.nodesTraveled`).
   */
  nodeIndex: number;
  ///**
  // * The number of meters traveled within `RouteStep`.
  // * Range is [0, `RouteStep.distanceMeters].
  // */
  //distanceMeters: number;
}
