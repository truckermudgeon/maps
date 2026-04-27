import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';
import type { MappedDataForKeys } from '@truckermudgeon/io';
import type { CompanyItem, FerryItem, Prefab, Road } from './types';

/**
 * Returns the common item between two adjacent graph nodes, starting at
 * `aNodeUid` and ending at `bNodeUid`.
 *
 * Note that the order of `aNodeUid` and `bNodeUid` only matters
 * when dealing with FerryItems: the returned common item will always be the
 * FerryItem associated with `bNodeUid` (the destination ferry terminal).
 */
export function getCommonItem(
  aNodeUid: bigint,
  bNodeUid: bigint,
  tsMapData: MappedDataForKeys<['nodes', 'roads', 'prefabs', 'companies']>,
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
      return assertExists(
        ferriesByUid.get(bItemUids[0]),
        `a ferry prefab / route does not exist between nodes ${aNodeUid.toString(16)} and ${bNodeUid.toString(16)}`,
      );
    } else if (aItemUids.find(uid => ferriesByUid.has(uid))) {
      // `aNodeUid` has a ferry item when going:
      // - from ferry node to ferry prefab exit
      return assertExists(
        ferriesByUid.get(aItemUids[0]),
        `a ferry prefab does not exist between nodes ${aNodeUid.toString(16)} and ${bNodeUid.toString(16)}`,
      );
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
        `a common item does not exist between nodes ${aNodeUid.toString(16)} and ${bNodeUid.toString(16)}`,
      );
    }
  }

  return assertExists(
    roads.get(sharedItemUid) ??
      prefabs.get(sharedItemUid) ??
      companies.get(sharedItemUid),
    `unknown common item for uid ${sharedItemUid.toString(16)}`,
  );
}
