import { assertExists } from '@truckermudgeon/base/assert';
import { mapValues, putIfAbsent } from '@truckermudgeon/base/map';
import { fromAtsCoordsToWgs84 } from '@truckermudgeon/map/projections';
import type {
  Company,
  DemoCompany,
  DemoCompanyDef,
  DemoNeighbor,
  DemoNeighbors,
  DemoRoutesData,
  Neighbor,
  Neighbors,
} from '@truckermudgeon/map/types';
import type { MappedData } from '../mapped-data';

export function toDemoGraph(
  graph: Map<string, Neighbors>,
  tsMapData: MappedData,
): DemoRoutesData {
  const allNodeUids = new Set<string>();
  for (const [nodeUid, neighbors] of graph.entries()) {
    allNodeUids.add(nodeUid);
    for (const neighbor of [...neighbors.forward, ...neighbors.backward]) {
      allNodeUids.add(neighbor.nodeId);
    }
  }

  // Re-map node uids to shorter base36 numbers.
  let idCount = 0;
  const nodeUidMap = new Map(
    [...allNodeUids].map(nodeUid => [nodeUid, (idCount++).toString(36)]),
  );

  const { companies, companyDefs, nodes } = tsMapData;

  // the demo app needs:
  // * graph with re-mapped node uids, and minimized data (shorter prop keys, elided props)
  const demoGraph = new Map<string, DemoNeighbors>();
  for (const [nodeUid, neighbors] of graph.entries()) {
    demoGraph.set(
      assertExists(nodeUidMap.get(nodeUid)),
      toDemoNeighbors(neighbors, nodeUidMap),
    );
  }

  // * nodes with re-mapped node uids and position info
  const demoNodes = new Map<string, [number, number]>();
  for (const uid of allNodeUids) {
    const node = assertExists(nodes.get(uid));
    const remappedId = assertExists(nodeUidMap.get(uid));
    const [x, y] = fromAtsCoordsToWgs84([node.x, node.y]).map(n =>
      Number(n.toFixed(3)),
    );
    demoNodes.set(remappedId, [x, y]);
  }

  // * companies with re-mapped node uids, and node uids of other companies they can deliver to
  const eligibleCompanies = [...companies.values()].filter(c =>
    allNodeUids.has(c.nodeUid.toString(16)),
  );
  const companyDefsByCargoIn = new Map<string, Company[]>();
  for (const company of eligibleCompanies) {
    const companyDef = assertExists(companyDefs.get(company.token));
    for (const cargoIn of companyDef.cargoInTokens) {
      putIfAbsent(cargoIn, [], companyDefsByCargoIn).push(companyDef);
    }
  }

  const demoCompanies: DemoCompany[] = eligibleCompanies.map(company => ({
    n: assertExists(nodeUidMap.get(company.nodeUid.toString(16))),
    t: company.token,
    c: company.cityToken,
  }));
  const demoCompanyDefs: Map<string, DemoCompanyDef> = mapValues(
    companyDefs,
    companyDef => ({
      t: companyDef.token,
      d: [
        ...new Set(
          companyDef.cargoOutTokens.flatMap(cargoOut =>
            (companyDefsByCargoIn.get(cargoOut) ?? []).map(def => def.token),
          ),
        ),
      ],
    }),
  );

  return {
    demoGraph: [...demoGraph.entries()],
    demoNodes: [...demoNodes.entries()],
    demoCompanies,
    demoCompanyDefs: [...demoCompanyDefs.values()],
  };
}

function toDemoNeighbors(
  neighbors: Neighbors,
  nodeUidMap: Map<string, string>,
): DemoNeighbors {
  const { forward, backward } = neighbors;
  const toNeighbor = (n: Neighbor): DemoNeighbor =>
    toDemoNeighbor(n, nodeUidMap);
  return {
    f: forward.length ? forward.map(toNeighbor) : undefined,
    b: backward.length ? backward.map(toNeighbor) : undefined,
  };
}

function toDemoNeighbor(
  neighbor: Neighbor,
  nodeUidMap: Map<string, string>,
): DemoNeighbor {
  return {
    n: assertExists(nodeUidMap.get(neighbor.nodeId)),
    l: Math.round(neighbor.distance),
    o: neighbor.isOneLaneRoad,
    d: neighbor.direction[0] as 'f' | 'b',
    g: neighbor.dlcGuard,
  };
}
