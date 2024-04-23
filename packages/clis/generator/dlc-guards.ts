import { assertExists } from '@truckermudgeon/base/assert';
import { putIfAbsent } from '@truckermudgeon/base/map';
import { Preconditions } from '@truckermudgeon/base/precon';
import {
  AtsCountryIdToDlcGuard,
  AtsDlcGuards,
  type AtsCountryId,
  type AtsDlcGuard,
} from '@truckermudgeon/map/constants';
import type {
  MapArea,
  Node,
  Poi,
  Prefab,
  Road,
} from '@truckermudgeon/map/types';
import type { Quadtree } from 'd3-quadtree';
import { quadtree } from 'd3-quadtree';
import { logger } from './logger';

interface QtDlcGuardEntry {
  x: number;
  y: number;
  dlcGuard: number;
}

export type DlcGuardQuadTree = Quadtree<QtDlcGuardEntry>;

export function normalizeDlcGuards(
  roads: Map<string, Road>,
  prefabs: Map<string, Prefab>,
  mapAreas: Map<string, MapArea>,
  pois: Poi[],
  context: {
    map: 'usa' | 'europe';
    nodes: Map<string, Node>;
  },
): DlcGuardQuadTree | undefined {
  const { map, nodes } = context;
  if (map === 'europe') {
    logger.error('ets2 dlc guard normalization is not yet supported.');
    return;
  }

  const dlcQuadTree: DlcGuardQuadTree = quadtree<QtDlcGuardEntry>()
    .x(e => e.x)
    .y(e => e.y);
  const unknownDlcGuards = new Set<number>();

  // returns a normalized dlc guard, or undefined if dlcGuard cannot / should
  // not be normalized.
  const normalizeDlcGuard = (
    dlcGuard: number,
    nodeUids: readonly bigint[],
  ): number | undefined => {
    Preconditions.checkArgument(nodeUids.length > 0);
    if (AtsDlcGuards[dlcGuard as AtsDlcGuard] == null) {
      unknownDlcGuards.add(dlcGuard);
      return;
    }
    if (dlcGuard !== 0) {
      return;
    }

    // An item with `dlcGuard: 0` does _not_ mean that the item belongs to the
    // base-game map content. In order for DLC hiding to work closer to what's
    // expected, infer a DLC Guard value based on the country IDs of the Nodes
    // associated with `nodeUids`.

    // Map of country ids to number of occurrences
    const countryIdCounts = new Map<number, number>();

    // count non-zero country ids for corresponding nodes
    for (const cid of nodeUids.flatMap(nid => getCountryIds(nid, nodes))) {
      const curCount = putIfAbsent(cid, 0, countryIdCounts);
      countryIdCounts.set(cid, curCount + 1);
    }

    // find the most frequently ref'd country id
    const mostReferencedEntries = [...countryIdCounts.entries()].sort(
      ([, av], [, bv]) => bv - av,
    );
    if (mostReferencedEntries.length === 0) {
      // no non-zero country IDs. Fallback to the dlc guard associated with the
      // closest node within 100m.
      const node = assertExists(nodes.get(nodeUids[0].toString(16)));
      const closestNode = dlcQuadTree.find(node.x, node.y, 100);
      return closestNode?.dlcGuard;
    }

    const countryId = mostReferencedEntries[0][0];
    const equivDlcGuard = AtsCountryIdToDlcGuard[countryId as AtsCountryId];
    if (equivDlcGuard == null) {
      // no matching dlc guard for country id
      logger.warn('unknown country id', countryId);
      return;
    }

    for (const nid of nodeUids) {
      const nidString = nid.toString(16);
      const node = assertExists(nodes.get(nidString));
      dlcQuadTree.add({
        x: node.x,
        y: node.y,
        dlcGuard: equivDlcGuard,
      });
    }
    return equivDlcGuard;
  };

  // Roads must be processed first, so that the QuadTree can be populated with
  // accurate-ish dlc guard values for use as fallbacks by other Items.
  for (const [key, road] of roads) {
    const dlcGuard = normalizeDlcGuard(road.dlcGuard, [
      road.startNodeUid,
      road.endNodeUid,
    ]);
    if (dlcGuard != null) {
      roads.set(key, { ...road, dlcGuard });
    }
  }

  for (const [key, prefab] of prefabs) {
    const dlcGuard = normalizeDlcGuard(prefab.dlcGuard, prefab.nodeUids);
    if (dlcGuard != null) {
      prefabs.set(key, { ...prefab, dlcGuard });
    }
  }

  for (const [key, mapArea] of mapAreas) {
    const dlcGuard = normalizeDlcGuard(mapArea.dlcGuard, mapArea.nodeUids);
    if (dlcGuard != null) {
      mapAreas.set(key, { ...mapArea, dlcGuard });
    }
  }

  for (let i = 0; i < pois.length; i++) {
    const poi = pois[i];
    if (poi.type === 'landmark' || poi.type === 'road') {
      const dlcGuard = normalizeDlcGuard(poi.dlcGuard, [poi.nodeUid]);
      if (dlcGuard != null) {
        pois[i] = { ...poi, dlcGuard };
      }
    } else if (poi.type === 'facility' && poi.icon === 'parking_ico') {
      const dlcGuard = normalizeDlcGuard(poi.dlcGuard, poi.itemNodeUids);
      if (dlcGuard != null) {
        pois[i] = { ...poi, dlcGuard };
      }
    }
  }

  logger.warn('Unknown ATS dlc guards', unknownDlcGuards);
  return dlcQuadTree;
}

function getCountryIds(nodeUid: bigint, nodes: Map<string, Node>): number[] {
  const node = assertExists(nodes.get(nodeUid.toString(16)));
  const { forwardCountryId, backwardCountryId } = node;
  if (forwardCountryId !== backwardCountryId) {
    logger.warn('country mismatch', forwardCountryId, backwardCountryId);
  }
  // Filter out 0, which isn't a valid country id.
  return [forwardCountryId, backwardCountryId].filter(id => id !== 0);
}
