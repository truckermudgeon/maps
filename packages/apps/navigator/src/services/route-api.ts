import type {
  Route,
  RouteWithSummary,
  SearchResult,
} from '@truckermudgeon/navigation/types';
import type { AppClient } from '../controllers/types';

/**
 * Route-related tRPC procedures.
 */
export interface RouteApi {
  previewRoutes(toNodeUid: string): Promise<RouteWithSummary[]>;
  setActiveRoute(segmentKeys: string[] | undefined): Promise<void>;
  generateRouteFromNodeUids(nodeUidsHex: string[]): Promise<Route>;
  synthesizeSearchResult(lonLat: [number, number]): Promise<SearchResult>;
  unpauseRouteEvents(): Promise<void>;
}

export class RouteApiImpl implements RouteApi {
  constructor(private readonly client: AppClient) {}

  previewRoutes(toNodeUid: string) {
    return this.client.previewRoutes.query({ toNodeUid });
  }

  setActiveRoute(segmentKeys: string[] | undefined) {
    return this.client.setActiveRoute.mutate(segmentKeys);
  }

  generateRouteFromNodeUids(nodeUidsHex: string[]) {
    return this.client.generateRouteFromNodeUids.query(nodeUidsHex);
  }

  synthesizeSearchResult(lonLat: [number, number]) {
    return this.client.synthesizeSearchResult.query(lonLat);
  }

  unpauseRouteEvents() {
    return this.client.unpauseRouteEvents.mutate();
  }
}
