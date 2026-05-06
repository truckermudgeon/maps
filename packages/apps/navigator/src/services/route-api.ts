import type { AppClient } from '../controllers/types';

/**
 * Thin wrappers around the route-related tRPC procedures. Centralizes
 * the call sites so consumers don't reach into the tRPC client shape
 * directly, which makes mocking and renaming easier.
 */

export function previewRoutes(client: AppClient, toNodeUid: string) {
  return client.previewRoutes.query({ toNodeUid });
}

export function setActiveRoute(
  client: AppClient,
  segmentKeys: string[] | undefined,
) {
  return client.setActiveRoute.mutate(segmentKeys);
}

export function generateRouteFromNodeUids(
  client: AppClient,
  nodeUidsHex: string[],
) {
  return client.generateRouteFromNodeUids.query(nodeUidsHex);
}

export function synthesizeSearchResult(
  client: AppClient,
  lonLat: [number, number],
) {
  return client.synthesizeSearchResult.query(lonLat);
}

export function unpauseRouteEvents(client: AppClient) {
  return client.unpauseRouteEvents.mutate();
}
