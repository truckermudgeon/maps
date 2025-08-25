import { assertExists } from '@truckermudgeon/base/assert';
import { putIfAbsent } from '@truckermudgeon/base/map';
import { Preconditions } from '@truckermudgeon/base/precon';
import {
  AtsCountryIdToDlcGuard,
  AtsDlcGuards,
  type AtsCountryId,
  type AtsDlcGuard,
} from '@truckermudgeon/map/constants';
import type { Node } from '@truckermudgeon/map/types';
import type { Quadtree } from 'd3-quadtree';
import { quadtree } from 'd3-quadtree';
import { logger } from './logger';
import type { MapDataKeys, MappedDataForKeys } from './mapped-data';

interface QtDlcGuardEntry {
  x: number;
  y: number;
  dlcGuard: number;
}

export type DlcGuardQuadTree = Quadtree<QtDlcGuardEntry>;

export const dlcGuardMapDataKeys = [
  'nodes',
  // Item types that have a `dlcGuard` field
  'roads',
  'prefabs',
  'mapAreas',
  'triggers',
  'cutscenes',
  // note: Pois representing MapOverlays have a `dlcGuard` field. other Pois
  // may not.
  'pois',
] satisfies MapDataKeys;

export type DlcGuardMappedData = MappedDataForKeys<typeof dlcGuardMapDataKeys>;

/**
 * Returns a copy of `tsMapData`, where the items in the collections have
 * best-effort normalized `dlcGuard` values, along with a quadtree that can
 * be used to find the closest normalized `dlcGuard` for a given point.
 *
 * An item with a `dlcGuard` of 0 does _not_ mean that the item belongs to the
 * base-game map content. In order for DLC hiding to work as if that were the
 * case, 0-values are normalized based on the country IDs of the Nodes
 * associated with the item.
 */
export function normalizeDlcGuards<T extends DlcGuardMappedData>(
  tsMapData: T,
): T & { dlcGuardQuadTree?: DlcGuardQuadTree } {
  const { map } = tsMapData;
  if (map === 'europe') {
    logger.error('ets2 dlc guard normalization is not yet supported.');
    return tsMapData;
  }

  const nodes = new Map(tsMapData.nodes);
  const roads = new Map(tsMapData.roads);
  const prefabs = new Map(tsMapData.prefabs);
  const mapAreas = new Map(tsMapData.mapAreas);
  const triggers = new Map(tsMapData.triggers);
  const cutscenes = new Map(tsMapData.cutscenes);
  const pois = new Array(...tsMapData.pois);

  const dlcGuardQuadTree: DlcGuardQuadTree = quadtree<QtDlcGuardEntry>()
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
    nodeUids = nodeUids.filter(nid => nodes.has(nid));
    if (nodeUids.length === 0) {
      return;
    }

    if (dlcGuard !== 0) {
      for (const nid of nodeUids) {
        const node = assertExists(nodes.get(nid));
        dlcGuardQuadTree.add({
          x: node.x,
          y: node.y,
          dlcGuard,
        });
      }
      return;
    }

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
      // closest node.
      const node = assertExists(nodes.get(nodeUids[0]));
      const closestNode = dlcGuardQuadTree.find(node.x, node.y);
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
      const node = assertExists(nodes.get(nid));
      dlcGuardQuadTree.add({
        x: node.x,
        y: node.y,
        dlcGuard: equivDlcGuard,
      });
    }
    return equivDlcGuard;
  };

  const updateMap = <T extends { dlcGuard: number }>(
    map: Map<bigint, T>,
    getNodeUids: (t: T) => readonly bigint[],
  ) => {
    for (const [key, t] of map) {
      const dlcGuard = normalizeDlcGuard(t.dlcGuard, getNodeUids(t));
      if (dlcGuard != null) {
        map.set(key, { ...t, dlcGuard });
      }
    }
  };

  // Roads must be processed first, so that the QuadTree can be populated with
  // accurate-ish dlc guard values for use as fallbacks by other Items.
  updateMap(roads, road => [road.startNodeUid, road.endNodeUid]);

  updateMap(prefabs, prefab => prefab.nodeUids);
  updateMap(mapAreas, mapArea => mapArea.nodeUids);
  updateMap(triggers, trigger => trigger.nodeUids);
  updateMap(cutscenes, cutscene => [cutscene.nodeUid]);

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
  return {
    ...tsMapData,
    nodes,
    roads,
    prefabs,
    mapAreas,
    triggers,
    cutscenes,
    dlcGuardQuadTree,
  };
}

function getCountryIds(
  nodeUid: bigint,
  nodes: ReadonlyMap<bigint, Node>,
): number[] {
  const node = assertExists(nodes.get(nodeUid));
  const { forwardCountryId, backwardCountryId } = node;
  if (forwardCountryId !== backwardCountryId) {
    logger.warn('country mismatch', forwardCountryId, backwardCountryId);
  }
  // Filter out 0, which isn't a valid country id.
  return [forwardCountryId, backwardCountryId].filter(id => id !== 0);
}
