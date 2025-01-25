import type { Mode } from '@truckermudgeon/map/routing';
import type { BranchType } from './constants';

export interface RouteDirection {
  direction: BranchType;
  distanceMeters: number;
  name?: {
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

export interface SearchResult {
  nodeUid: string;
  lonLat: [number, number];
  distanceMeters: number; // as the crow flies
  bearing: number;
  name: string;
  logoUrl: string;
  city: string;
  state: string;
  isCityStateApproximate: boolean;
  facilityUrls: string[];
}

interface RouteSegment {
  key: string;
  lonLats: [number, number][];
  distance: number;
  time: number;
  strategy: Mode;
}

export interface Route {
  id: string;
  segments: RouteSegment[];
}

export interface TrailerState {
  attached: false;
  x: number;
  y: number;
}
