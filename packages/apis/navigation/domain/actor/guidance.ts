import polyline from '@mapbox/polyline';
import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';
import type { MappedDataForKeys } from '@truckermudgeon/generator/mapped-data';
import { ItemType } from '@truckermudgeon/map/constants';
import type {
  CompanyItem,
  FerryItem,
  Neighbor,
  Prefab,
  Road,
} from '@truckermudgeon/map/types';
import type { RouteStep } from '../../types';
import type { GraphAndMapData } from '../lookup-data';
import { RouteStepBuilder } from './route-step-builder';

type GuidanceMappedData = MappedDataForKeys<
  [
    'nodes',
    'roads',
    'prefabs',
    'companies',
    'ferries',
    'prefabDescriptions',
    'roadLooks',
  ]
>;

// doesn't produce RouteSteps with arrive | depart maneuvers. up to callers to
// do that.
// TODO enforce in types.
export function calculateSteps(
  neighbors: Neighbor[],
  context: GuidanceMappedData,
  signRTree: GraphAndMapData['signRTree'],
): RouteStep[] {
  Preconditions.checkArgument(
    neighbors.length > 0,
    'neighbors must not be empty',
  );

  const start = Date.now();
  console.log('calculating steps for', neighbors.length, 'neighbors');

  let curNode = assertExists(context.nodes.get(neighbors[0].nodeUid));
  console.log('first node', curNode);
  console.log('last node', neighbors.at(-1)!.nodeUid);

  const builder = new RouteStepBuilder(context, signRTree);
  // TODO precalc this lookup. And consider merging Ferry & FerryItem types.
  const ferriesByUid = new Map<bigint, FerryItem>(
    context.ferries.values().map(f => [f.uid, { ...f, type: ItemType.Ferry }]),
  );
  // TODO precalc this lookup
  const companiesByPrefab = new Map<bigint, CompanyItem>(
    context.companies.values().map(c => [c.prefabUid, c]),
  );
  const lookups = {
    ferriesByUid,
    companiesByPrefab,
  };

  for (let i = 1; i < neighbors.length; i++) {
    const neighbor = neighbors[i];
    const nextNode = assertExists(context.nodes.get(neighbor.nodeUid));
    if (curNode.uid === nextNode.uid) {
      // expected for degenerate routes.
      continue;
    }
    const linkedItem = getCommonItem(
      curNode.uid,
      nextNode.uid,
      context,
      lookups,
    );
    builder.add(linkedItem, curNode, nextNode, neighbor);
    curNode = nextNode;
  }

  // do a preliminary cleanup pass, because of bad route data, e.g.,
  // consecutive company edges that ping-pong back and forth, and/or
  // can be skipped because of roads.
  // MAYBE solution to the GARC problem is to re-assign company item's node to
  // be that of the nearest road node or prefab node?

  const routeSteps = builder.build();
  const encoded = routeSteps.map(step => {
    return {
      ...step,
      geometry: polyline.encode(step.geometry),
    };
  });

  console.log('calculate steps duration:', Date.now() - start, 'ms');

  return encoded;
}

/**
 * Returns the common item between two graph nodes, starting at `aNodeUid` and
 * ending at `bNodeUid`.
 *
 * Note that the order of `aNodeUid` and `bNodeUid` only matters
 * when dealing with FerryItems: the returned common item will always be the
 * FerryItem associated with `bNodeUid` (the destination ferry terminal).
 */
export function getCommonItem(
  aNodeUid: bigint,
  bNodeUid: bigint,
  tsMapData: GuidanceMappedData,
  lookups: {
    ferriesByUid: ReadonlyMap<bigint, FerryItem>;
    companiesByPrefab: ReadonlyMap<bigint, CompanyItem>;
  },
): Road | Prefab | CompanyItem | FerryItem {
  Preconditions.checkArgument(aNodeUid !== bNodeUid);
  const { nodes, roads, prefabs, companies } = tsMapData;
  const { ferriesByUid, companiesByPrefab } = lookups;
  const a = assertExists(nodes.get(aNodeUid));
  const b = assertExists(nodes.get(bNodeUid));

  const aItemUids = [a.forwardItemUid, a.backwardItemUid].filter(
    uid => uid !== 0n,
  );
  const bItemUids = [b.forwardItemUid, b.backwardItemUid].filter(
    uid => uid !== 0n,
  );

  const sharedItemUid = aItemUids.find(aUid =>
    bItemUids.some(bUid => aUid === bUid),
  );

  if (!sharedItemUid) {
    if (bItemUids.find(uid => ferriesByUid.has(uid))) {
      // `bNodeUid` has a ferry item when going:
      // - from ferry prefab exit to ferry node, or
      // - from origin ferry to dest ferry.
      return assertExists(ferriesByUid.get(bItemUids[0]));
    } else if (aItemUids.find(uid => ferriesByUid.has(uid))) {
      // `aNodeUid` has a ferry item when going:
      // - from ferry node to ferry prefab exit
      return assertExists(ferriesByUid.get(aItemUids[0]));
    } else {
      // check for company edge-case
      const aCompanies = [
        companiesByPrefab.get(a.forwardItemUid) ??
          companies.get(a.forwardItemUid),
        companiesByPrefab.get(a.backwardItemUid) ??
          companies.get(a.backwardItemUid),
      ].filter(c => c != null);
      const bCompanies = [
        companiesByPrefab.get(b.forwardItemUid) ??
          companies.get(b.forwardItemUid),
        companiesByPrefab.get(b.backwardItemUid) ??
          companies.get(b.backwardItemUid),
      ].filter(c => c != null);
      const fallbackCompany = [...aCompanies, ...bCompanies][0];

      return assertExists(
        aCompanies.find(ac => bCompanies.some(bc => ac.uid === bc.uid)) ??
          fallbackCompany,
        `a company does not exist between nodes ${aNodeUid.toString(16)} and ${bNodeUid.toString(16)}`,
      );
    }
  }

  return assertExists(
    roads.get(sharedItemUid) ??
      prefabs.get(sharedItemUid) ??
      companies.get(sharedItemUid),
    `no common item`,
  );
}
