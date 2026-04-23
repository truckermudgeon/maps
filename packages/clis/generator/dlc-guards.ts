import { assertExists } from '@truckermudgeon/base/assert';
import { center, getExtent } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { MapDataKeys, MappedDataForKeys } from '@truckermudgeon/io';
import { AtsDlcGuards, Ets2DlcGuards } from '@truckermudgeon/map/constants';
import { PointRBush } from '@truckermudgeon/map/point-rbush';
import { logger } from './logger';

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

interface DlcGuardPoint {
  x: number;
  y: number;
  dlcGuard: number;
}

export type DlcGuardSpatialIndex = PointRBush<DlcGuardPoint>;

/**
 * Returns a spatial index that can be used to find the closest `dlcGuard` for
 * a given point. The spatial index is based on the centers of map items with
 * a `dlcGuard` field.
 */
export function buildDlcGuardSpatialIndex<T extends DlcGuardMappedData>(
  tsMapData: T,
): DlcGuardSpatialIndex {
  const { nodes, roads, prefabs, mapAreas, triggers, cutscenes, pois } =
    tsMapData;
  let dlcGuards: Record<number, unknown>;
  switch (tsMapData.map) {
    case 'usa':
      dlcGuards = AtsDlcGuards;
      break;
    case 'europe':
      dlcGuards = Ets2DlcGuards;
      break;
    default:
      throw new UnreachableError(tsMapData.map);
  }

  const unknownDlcGuards = new Set<number>();
  const points: DlcGuardPoint[] = [];
  const updateItems = <T extends { dlcGuard: number }>(
    collection: Iterable<T>,
    getNodeUids: (t: T) => readonly bigint[],
  ) => {
    for (const t of collection) {
      const itemNodes = getNodeUids(t).map(nid => assertExists(nodes.get(nid)));
      const itemCenter = center(getExtent(itemNodes));
      points.push({
        x: itemCenter[0],
        y: itemCenter[1],
        dlcGuard: t.dlcGuard,
      });
      if (dlcGuards[t.dlcGuard] == null) {
        unknownDlcGuards.add(t.dlcGuard);
      }
    }
  };

  updateItems(roads.values(), road => [road.startNodeUid, road.endNodeUid]);
  updateItems(prefabs.values(), prefab => prefab.nodeUids);
  updateItems(mapAreas.values(), mapArea => mapArea.nodeUids);
  updateItems(triggers.values(), trigger => trigger.nodeUids);
  updateItems(cutscenes.values(), cutscene => [cutscene.nodeUid]);

  const dlcGuardedPois: (DlcGuardPoint & { nodeUids: readonly bigint[] })[] =
    [];
  for (const poi of pois) {
    if (poi.type === 'landmark' || poi.type === 'road') {
      dlcGuardedPois.push({
        ...poi,
        nodeUids: [poi.nodeUid],
      });
    } else if (poi.type === 'facility' && poi.icon === 'parking_ico') {
      dlcGuardedPois.push({
        ...poi,
        nodeUids: poi.itemNodeUids,
      });
    }
  }
  updateItems(dlcGuardedPois, poi => poi.nodeUids);

  const rtree = new PointRBush<{ x: number; y: number; dlcGuard: number }>();
  rtree.load(points);

  logger.warn('Unknown', tsMapData.map, 'dlc guards', unknownDlcGuards);
  return rtree;
}
