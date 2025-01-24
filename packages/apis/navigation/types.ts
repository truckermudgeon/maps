import type { z } from 'zod';
import type { BranchType, RouteSchema } from './constants';

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

export type Route = z.infer<typeof RouteSchema>;
