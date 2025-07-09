import { assert, assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import { mapValues, putIfAbsent } from '@truckermudgeon/base/map';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import { ItemType } from '@truckermudgeon/map/constants';
import { calculateNodeConnections } from '@truckermudgeon/map/prefabs';
import type { Direction } from '@truckermudgeon/map/routing';
import type {
  CompanyItem,
  Neighbor,
  Node,
  Prefab,
} from '@truckermudgeon/map/types';
import { quadtree } from 'd3-quadtree';
import { dlcGuardMapDataKeys, normalizeDlcGuards } from '../dlc-guards';
import { logger } from '../logger';
import type { MapDataKeys, MappedDataForKeys } from '../mapped-data';

type GraphContextMappedData = MappedDataForKeys<
  [
    'nodes',
    'roads',
    'roadLooks',
    'prefabs',
    'prefabDescriptions',
    'companies',
    'ferries',
  ]
>;

type Context = GraphContextMappedData & {
  prefabConnections: Map<string, Map<number, number[]>>;
  companiesByPrefabItemId: Map<bigint, CompanyItem>;
  getDlcGuard: (node: Node) => number;
};

export const graphMapDataKeys = [
  ...dlcGuardMapDataKeys,
  'companies',
  'ferries',
  'prefabDescriptions',
  'roadLooks',
  'cities',
] satisfies MapDataKeys;

type GraphMappedData = MappedDataForKeys<typeof graphMapDataKeys>;

export function generateGraph(tsMapData: GraphMappedData) {
  const {
    map,
    nodes: _nodes,
    roads,
    prefabs: _prefabs,
    companies: _companies,
    ferries,
    prefabDescriptions,
    roadLooks,
    dlcGuardQuadTree,
  } = normalizeDlcGuards(tsMapData);
  const getDlcGuard = (node: Node): number =>
    dlcGuardQuadTree?.find(node.x, node.y)?.dlcGuard ?? -1;

  // Part of the pre-processing phase involves deleting entries from the nodes
  // and prefabs maps. Create mutable copies to allow for this.
  const nodes = new Map(_nodes);
  const prefabs = new Map(_prefabs);

  const companies = new Map(
    [..._companies.entries()].filter(([, company]) =>
      // filter out companies in unknown cities (e.g., cities in upcoming DLC)
      tsMapData.cities.has(company.cityToken),
    ),
  );
  const companiesByPrefabItemId = new Map(
    companies.values().map(companyItem => [companyItem.prefabUid, companyItem]),
  );

  for (const company of companies.values()) {
    if (!prefabs.has(company.prefabUid)) {
      logger.warn(
        'could not find prefab for company',
        company.token,
        company.cityToken,
      );
    }
  }

  const toSectorKey = (o: { x: number; y: number }) =>
    `${Math.floor(o.x / 4000)},${Math.floor(o.y / 4000)}`;
  const nodesBySector = new Map<string, Node[]>();
  const getRoadOrPrefab = (id: bigint) => roads.get(id) ?? prefabs.get(id);
  for (const node of nodes.values()) {
    const { forwardItemUid, backwardItemUid } = node;
    const connectedItem =
      getRoadOrPrefab(forwardItemUid) ?? getRoadOrPrefab(backwardItemUid);
    if (connectedItem) {
      putIfAbsent(toSectorKey(node), [], nodesBySector).push(node);
    }
  }

  // The graph around company nodes can be a bit weird. Remove some prefabs and their associated nodes in the hopes that
  // the regular graph-building logic + fallback graph-building logic will produce connected routes for all companies.
  const unconnectedCompanyPrefabs: Prefab[] = [];
  const allPrefabs = [...prefabs.values()];
  for (const prefab of allPrefabs) {
    const prefabNodes = prefab.nodeUids.map(id => assertExists(nodes.get(id)));
    if (
      prefabNodes.every(
        node =>
          (node.forwardItemUid === prefab.uid &&
            getRoadOrPrefab(node.backwardItemUid) == null) ||
          (node.backwardItemUid === prefab.uid &&
            getRoadOrPrefab(node.forwardItemUid) == null),
      )
    ) {
      const otherNodes = assertExists(
        nodesBySector.get(toSectorKey(prefab)),
      ).filter(node => !prefabNodes.find(pfn => node.uid === pfn.uid));
      const nodesLinkingToPrefab = otherNodes.filter(
        n =>
          (n.forwardItemUid === prefab.uid &&
            getRoadOrPrefab(n.backwardItemUid) != null) ||
          (n.backwardItemUid === prefab.uid &&
            getRoadOrPrefab(n.forwardItemUid) != null),
      );

      if (nodesLinkingToPrefab.length === 0) {
        prefabs.delete(prefab.uid);
        // delete prefab nodes from `nodes` map
        prefab.nodeUids.forEach(id => nodes.delete(id));
        // delete prefab nodes from `nodesBySector`
        const prefabNodeUids = new Set(prefab.nodeUids);
        const otherNodesMinusPrefabNodes = otherNodes.filter(
          n => !prefabNodeUids.has(n.uid),
        );
        nodesBySector.set(toSectorKey(prefab), otherNodesMinusPrefabNodes);

        if (companiesByPrefabItemId.has(prefab.uid)) {
          unconnectedCompanyPrefabs.push(prefab);
        }
      }
    }
  }

  const context: Context = {
    map,
    nodes,
    roads,
    roadLooks,
    prefabs,
    prefabDescriptions,
    prefabConnections: mapValues(prefabDescriptions, prefabDesc =>
      calculateNodeConnections(prefabDesc),
    ),
    companies,
    companiesByPrefabItemId,
    ferries,
    getDlcGuard,
  };

  logger.log('building graph...');

  // keyed by node uids
  const graph = new Map<
    bigint,
    { forward: Neighbor[]; backward: Neighbor[] }
  >();
  for (const node of nodes.values()) {
    const neighbors = {
      forward: getNeighborsInDirection(node, 'forward', context),
      backward: getNeighborsInDirection(node, 'backward', context),
    };
    const hasNeighbors = neighbors.forward.length || neighbors.backward.length;
    if (hasNeighbors) {
      graph.set(node.uid, neighbors);
    }
  }

  updateGraphWithFerries(graph, context);

  // massage graph to address problematic intersections. specifically:
  // look for "dead end" nodes that can be exited in one direction, but can't be
  // exited in the opposite direction. such dead-end nodes should be exit-able in
  // any direction; e.g., if i start at a dead-end node, and there's
  // a valid edge in the backward direction to node N, then i should be able to
  // reach node N in the forward direction, too.
  // establish an exit edge in the opposite direction to deal with "bad" intersections,
  // like the one near the wallbert warehouse in sacramento.
  let fudged = 0;
  for (const [nodeId, edges] of graph.entries()) {
    const node = assertExists(nodes.get(nodeId));
    const forwardItem =
      roads.get(node.forwardItemUid) ?? prefabs.get(node.forwardItemUid);
    const backwardItem =
      roads.get(node.backwardItemUid) ?? prefabs.get(node.backwardItemUid);
    if (
      !forwardItem &&
      edges.forward.length === 0 &&
      edges.backward.length > 0
    ) {
      const backwardEdges = edges.backward.filter(edge => {
        const node = graph.get(edge.nodeUid);
        if (!node) {
          return false;
        }
        return [...node.forward, ...node.backward].some(
          returnEdge => returnEdge.nodeUid === nodeId,
        );
      });
      for (const edge of backwardEdges) {
        edges.forward.push(edge);
        fudged++;
      }
    } else if (
      !backwardItem &&
      edges.backward.length === 0 &&
      edges.forward.length > 0
    ) {
      const forwardEdges = edges.forward.filter(edge => {
        const node = graph.get(edge.nodeUid);
        if (!node) {
          return false;
        }
        return [...node.forward, ...node.backward].some(
          returnEdge => returnEdge.nodeUid === nodeId,
        );
      });
      for (const edge of forwardEdges) {
        edges.backward.push(edge);
        fudged++;
      }
    }
  }
  logger.info(fudged, 'hacky dead-end edges added');

  // sorta-fix unconnected companies (i.e., company nodes that haven't been connected to a prefab node
  // in prior graph-building steps).
  for (const prefab of unconnectedCompanyPrefabs) {
    const company = assertExists(companiesByPrefabItemId.get(prefab.uid));
    const companyNode = assertExists(nodes.get(company.nodeUid));
    assert(!graph.has(companyNode.uid));
    // at ths point, companyNodeUid is completely absent in the graph.
    // link the company node to the closest node already in the graph.
    const nodesInSectorRange = getObjectsInSectorRange(
      companyNode,
      nodesBySector,
    );
    let closest = nodesInSectorRange
      .sort((a, b) => distance(a, companyNode) - distance(b, companyNode))
      .find(n => n.uid !== companyNode.uid);
    if (!closest) {
      logger.error('no eligible nodes for', company.token, company.cityToken);
      throw new Error();
    }
    const closestInGraph = nodesInSectorRange
      .sort((a, b) => distance(a, companyNode) - distance(b, companyNode))
      .find(n => n.uid !== companyNode.uid && graph.has(n.uid));
    if (closestInGraph && closest.uid !== closestInGraph.uid) {
      logger.warn(
        `${company.cityToken}.${company.token} ${company.uid.toString(16)}:`,
        `graph does not contain entry for node ${closest.uid.toString(16)};`,
        `using ${closestInGraph.uid.toString(16)} instead.`,
        distance(closest, companyNode),
        'vs',
        distance(closestInGraph, companyNode),
      );
      closest = closestInGraph;
    }
    assert(graph.has(closest.uid));
    //logger.info(
    //  'hacked connection',
    //  Number(dist.toFixed(3)),
    //  company.token,
    //  company.cityToken,
    //  closest.uid.toString(16),
    //);
    // establish edges from company node to closest node
    graph.set(companyNode.uid, {
      forward: [
        createNeighbor(companyNode, closest, 'forward', getDlcGuard),
        createNeighbor(companyNode, closest, 'backward', getDlcGuard),
      ],
      backward: [],
    });
    // establish edges from closest node to company node
    const neighbors = graph.get(closest.uid)!;
    neighbors.forward.push(
      createNeighbor(closest, companyNode, 'forward', getDlcGuard),
      createNeighbor(closest, companyNode, 'backward', getDlcGuard),
    );
    neighbors.backward.push(
      createNeighbor(closest, companyNode, 'forward', getDlcGuard),
      createNeighbor(closest, companyNode, 'backward', getDlcGuard),
    );
  }

  logger.info(unconnectedCompanyPrefabs.length, 'hacky company edges added');

  // HACK deal with the prefab intersection that enters the wal_mkt company in lamar.
  // Connectivity says it can enter the wal_mkt, but it can never exit, so fudge an
  // edge that says we _can_ exit.
  // TODO write a general solution and search for all prefab intersections that lead into
  // a company prefab one-way, then add fudged edges (similar to the dead-end fudging earlier).
  if (map === 'usa' && graph.has(0x3301e888d4055f5en)) {
    const hackNeighbors = assertExists(graph.get(0x3301e888d4055f5en));
    hackNeighbors.forward.push({
      nodeUid: 0x3301e888b6855e83n,
      distance: 32,
      direction: 'forward',
      dlcGuard: 13, // The DLC Guard value for Colorado, which is where Lamar is.
    });
  }

  logger.info(
    graph.size,
    'nodes,',
    graph
      .values()
      .reduce((acc, ns) => acc + ns.forward.length + ns.backward.length, 0),
    'edges',
  );

  // TODO the graph currently being generated still includes disconnected sub-graphs
  // (e.g., 4a3f975872850005). Figure out why, and either detect + exclude them or
  // find the bug.

  return graph;
}

function updateGraphWithFerries(
  graph: Map<
    bigint,
    {
      forward: Neighbor[];
      backward: Neighbor[];
    }
  >,
  context: Context,
) {
  const { nodes, roads, prefabs, prefabDescriptions, ferries, getDlcGuard } =
    context;
  const roadQuadtree = quadtree<{
    x: number;
    y: number;
    nodeUid: bigint;
  }>()
    .x(e => e.x)
    .y(e => e.y);

  const maybeAddNode = (nid: bigint) => {
    const maybeNode = nodes.get(nid);
    if (maybeNode) {
      roadQuadtree.add({
        x: maybeNode.x,
        y: maybeNode.y,
        nodeUid: nid,
      });
    }
  };

  for (const road of roads.values()) {
    maybeAddNode(road.startNodeUid);
    maybeAddNode(road.endNodeUid);
  }
  for (const prefab of prefabs.values()) {
    // HACK ignore troublesome prefab near priwall ferry station:
    //   "token": "14004"
    //   "path": "prefab2/fork_temp/invis/invis_r1_fork_tmpl.ppd"
    // (navCurves data has empty nextLines and prevLines arrays)
    if (context.map === 'europe' && prefab.uid === 0x4cd14de4b6e67ccfn) {
      continue;
    }
    const desc = assertExists(prefabDescriptions.get(prefab.token));
    if (
      desc.mapPoints.every(p => p.type === 'road') &&
      desc.navCurves.length > 0
    ) {
      for (const nid of prefab.nodeUids) {
        maybeAddNode(nid);
      }
    }
  }

  for (const ferry of ferries.values()) {
    const ferryNodeUid = ferry.nodeUid;
    const ferryNode = assertExists(nodes.get(ferryNodeUid));
    const road = assertExists(roadQuadtree.find(ferry.x, ferry.y));

    // establish edges from closest road to ferry
    // TODO look into simplying graph by only having one direction to/from ferry
    const roadToFerryEdges: readonly Neighbor[] = [
      createNeighbor(road, ferryNode, 'forward', getDlcGuard),
      createNeighbor(road, ferryNode, 'backward', getDlcGuard),
    ];
    const roadNeighbors = assertExists(graph.get(road.nodeUid));
    roadNeighbors.forward.push(...roadToFerryEdges);
    roadNeighbors.backward.push(...roadToFerryEdges);

    assert(graph.get(ferryNodeUid) == null);
    graph.set(ferryNodeUid, { forward: [], backward: [] });
    const ferryNeighbors = assertExists(graph.get(ferryNodeUid));
    const roadNode = assertExists(nodes.get(road.nodeUid));
    // establish edges from origin ferry to closet road
    const ferryToRoadEdges: readonly Neighbor[] = [
      createNeighbor(ferryNode, roadNode, 'forward', getDlcGuard),
      createNeighbor(ferryNode, roadNode, 'backward', getDlcGuard),
    ];
    ferryNeighbors.forward.push(...ferryToRoadEdges);
    ferryNeighbors.backward.push(...ferryToRoadEdges);

    for (const connection of ferry.connections) {
      const otherFerryNodeUid = connection.nodeUid;
      const otherFerryNode = assertExists(nodes.get(otherFerryNodeUid));
      // establish edges from origin ferry to destination ferry
      const ferryToFerryEdges: readonly Neighbor[] = [
        {
          ...createNeighbor(ferryNode, otherFerryNode, 'forward', getDlcGuard),
          distance: connection.distance,
          isFerry: true,
        },
        {
          ...createNeighbor(ferryNode, otherFerryNode, 'backward', getDlcGuard),
          distance: connection.distance,
          isFerry: true,
        },
      ];
      ferryNeighbors.forward.push(...ferryToFerryEdges);
      ferryNeighbors.backward.push(...ferryToFerryEdges);
    }
  }
}

function getNeighborsInDirection(
  node: Node,
  direction: 'forward' | 'backward',
  context: Context,
): Neighbor[] {
  const getNeighborItemId = (n: Node) =>
    direction === 'forward' ? n.forwardItemUid : n.backwardItemUid;
  const getItem = (id: bigint) =>
    context.roads.get(id) ??
    context.prefabs.get(id) ??
    context.companies.get(id);
  const item = getItem(getNeighborItemId(node));
  if (!item) {
    // unknown neighbor item, e.g., a hidden or unknown road not present in context.
    return [];
  }

  const toNeighbor = (
    nextNode: Node,
    options: {
      distance?: number;
      direction?: 'forward' | 'backward';
      isOneLaneRoad?: true;
    } = {},
  ): Neighbor => {
    const dist =
      options.distance ?? distance([nextNode.x, nextNode.y], [node.x, node.y]);
    const dir = options.direction ?? direction;
    return {
      nodeUid: nextNode.uid,
      distance: dist,
      direction: dir,
      isOneLaneRoad: options.isOneLaneRoad,
      dlcGuard: context.getDlcGuard(nextNode),
    };
  };

  switch (item.type) {
    case ItemType.Road: {
      const originNodeId =
        direction === 'forward' ? item.startNodeUid : item.endNodeUid;
      const destNodeId =
        direction === 'forward' ? item.endNodeUid : item.startNodeUid;

      assert(originNodeId === node.uid);
      const roadLook = assertExists(context.roadLooks.get(item.roadLookToken));
      const lanesInDirection =
        direction === 'forward'
          ? roadLook.lanesRight.length
          : roadLook.lanesLeft.length;
      if (lanesInDirection === 0) {
        // can't go in direction.
        return [];
      }

      const nextNode = assertExists(context.nodes.get(destNodeId));
      return [
        toNeighbor(nextNode, {
          distance: item.length,
          isOneLaneRoad: lanesInDirection === 1 ? true : undefined,
        }),
      ];
    }
    case ItemType.Prefab: {
      const neighbors: Neighbor[] = [];
      const companyItem = context.companiesByPrefabItemId.get(item.uid);
      if (companyItem) {
        const nextNode = assertExists(context.nodes.get(companyItem.nodeUid));
        neighbors.push(toNeighbor(nextNode));
      }

      const connectionIndices = assertExists(
        context.prefabConnections.get(item.token),
      );
      if (!connectionIndices.size) {
        // prefab has no internal roads connecting its nodes,
        // e.g., in company depots.
        return neighbors;
      }

      const connectionNodes = convertToNodeMap(
        connectionIndices,
        item,
        context.nodes,
      );
      const connections = connectionNodes.get(node);
      if (!connections) {
        // no connections for `node` in `direction` means that the prefab is one-way
        return neighbors;
      }
      assert(connections.length > 0);
      return [
        ...neighbors,
        // TODO calculate lengths based on navCurves
        ...connections.map(nextNode =>
          toNeighbor(nextNode, {
            direction:
              getNeighborItemId(node) === getNeighborItemId(nextNode)
                ? direction === 'forward'
                  ? 'backward'
                  : 'forward'
                : direction,
          }),
        ),
      ];
    }
    case ItemType.Company: {
      assert(direction === 'forward');
      const prefab = context.prefabs.get(item.prefabUid);
      if (!prefab) {
        // logger.warn(
        //   'unknown prefab',
        //   item.prefabUid,
        //   'for company',
        //   item.uid,
        //   item.token,
        //   item.cityToken,
        // );
        return [];
      }
      const prefabNodes = prefab.nodeUids
        .map(id => assertExists(context.nodes.get(id)))
        .filter(
          node =>
            !(
              node.forwardItemUid === prefab.uid && node.backwardItemUid === 0n
            ),
        );
      return prefabNodes.flatMap(nextNode => [
        toNeighbor(nextNode),
        toNeighbor(nextNode, { direction: 'backward' }),
      ]);
    }
    default:
      throw new UnreachableError(item);
  }
}

function convertToNodeMap(
  connectionIndices: Map<number, number[]>,
  item: Prefab,
  nodes: ReadonlyMap<bigint, Node>,
): Map<Node, Node[]> {
  const nodeMap = new Map<Node, Node[]>();
  const destinationNodes = rotateRight(
    item.nodeUids.map(id => nodes.get(id)),
    item.originNodeIndex,
  );
  for (const [nodeIdx, cnxIdxs] of connectionIndices) {
    nodeMap.set(
      assertExists(destinationNodes[nodeIdx]),
      cnxIdxs.map(idx => assertExists(destinationNodes[idx])),
    );
  }

  return nodeMap;
}

function rotateRight<T>(arr: T[], count: number): T[] {
  Preconditions.checkArgument(0 <= count && count < arr.length);
  if (count === 0) {
    return arr;
  }

  return arr.slice(-count, arr.length).concat(arr.slice(0, -count));
}

function createNeighbor(
  from: { x: number; y: number },
  toNode: Node,
  direction: Direction,
  getDlcGuard: (n: Node) => number,
): Neighbor {
  return {
    nodeUid: toNode.uid,
    distance: distance(from, toNode),
    direction,
    dlcGuard: getDlcGuard(toNode),
  };
}

function getObjectsInSectorRange<T>(
  pos: { x: number; y: number },
  objectsBySector: Map<string, T[]>,
): T[] {
  const toKey = (x: number, y: number) => `${x},${y}`;
  let { x: sx, y: sy } = pos;
  sx = Math.floor(sx / 4000);
  sy = Math.floor(sy / 4000);
  return [
    ...(objectsBySector.get(toKey(sx - 1, sy - 1)) ?? []),
    ...(objectsBySector.get(toKey(sx + 0, sy - 1)) ?? []),
    ...(objectsBySector.get(toKey(sx + 1, sy - 1)) ?? []),
    ...(objectsBySector.get(toKey(sx - 1, sy + 0)) ?? []),
    ...(objectsBySector.get(toKey(sx + 0, sy + 0)) ?? []),
    ...(objectsBySector.get(toKey(sx + 1, sy + 0)) ?? []),
    ...(objectsBySector.get(toKey(sx - 1, sy + 1)) ?? []),
    ...(objectsBySector.get(toKey(sx + 0, sy + 1)) ?? []),
    ...(objectsBySector.get(toKey(sx + 1, sy + 1)) ?? []),
  ];
}
