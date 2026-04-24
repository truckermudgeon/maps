import { assert, assertExists } from '@truckermudgeon/base/assert';
import { distance, getExtent } from '@truckermudgeon/base/geom';
import { putIfAbsent } from '@truckermudgeon/base/map';
import type { MappedData, MappedDataForKeys } from '@truckermudgeon/io';
import { ItemType } from '@truckermudgeon/map/constants';
import { getLineString } from '@truckermudgeon/map/linestring';
import type { Lane } from '@truckermudgeon/map/prefabs';
import {
  calculateLaneInfo,
  calculateNodeConnections,
} from '@truckermudgeon/map/prefabs';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type {
  CompanyItem,
  FerryItem,
  Neighbor,
  Neighbors,
} from '@truckermudgeon/map/types';
import type { DbscanProps } from '@turf/clusters-dbscan';
import { clustersDbscan } from '@turf/clusters-dbscan';
import { featureCollection, point } from '@turf/helpers';
import fs from 'fs';
import type { GeoJSON } from 'geojson';

type AdjacencyList = Map<string, Set<string>>;

// ensures that graph has a key for every edge's start + end nodes.
function normalizeGraph(graph: AdjacencyList) {
  for (const neighbors of graph.values()) {
    for (const v of neighbors) {
      if (!graph.has(v)) {
        graph.set(v, new Set());
      }
    }
  }
}

function computeDegrees(graph: AdjacencyList): {
  inDeg: Map<string, number>;
  outDeg: Map<string, number>;
} {
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();

  for (const [v, neighbors] of graph) {
    outDeg.set(v, neighbors.size);

    for (const w of neighbors) {
      inDeg.set(w, (inDeg.get(w) ?? 0) + 1);
    }

    if (!inDeg.has(v)) {
      inDeg.set(v, 0);
    }
  }

  return { inDeg, outDeg };
}

function pruneDeadEnds(graph: AdjacencyList): AdjacencyList {
  const g = new Map(graph);
  let changed = true;

  while (changed) {
    changed = false;

    const { inDeg, outDeg } = computeDegrees(g);

    for (const v of g.keys()) {
      if ((inDeg.get(v) ?? 0) === 0 || (outDeg.get(v) ?? 0) === 0) {
        g.delete(v);
        for (const neighbors of g.values()) {
          neighbors.delete(v);
        }
        changed = true;
      }
    }
  }

  return g;
}

function collapseDirectedChains(graph: AdjacencyList): AdjacencyList {
  const { inDeg, outDeg } = computeDegrees(graph);

  const isChainNode = (v: string) =>
    (inDeg.get(v) ?? 0) === 1 && (outDeg.get(v) ?? 0) === 1;

  const result: AdjacencyList = new Map();
  const visited = new Set<string>();

  function addEdge(a: string, b: string) {
    putIfAbsent(a, new Set(), result).add(b);
  }

  for (const v of graph.keys()) {
    if (isChainNode(v)) {
      continue;
    }

    for (const n of assertExists(graph.get(v))) {
      let curr = n;

      while (isChainNode(curr) && !visited.has(curr)) {
        visited.add(curr);
        assert(graph.get(curr)!.size === 1);
        curr = graph.get(curr)!.values().next().value!;
      }

      if (curr !== v) addEdge(v, curr);
    }
  }

  // Handle pure cycles (all nodes are chain nodes)
  for (const v of graph.keys()) {
    if (isChainNode(v) && !visited.has(v)) {
      const cycle: string[] = [];
      let curr = v;

      do {
        visited.add(curr);
        cycle.push(curr);
        assert(graph.get(curr)!.size === 1);
        curr = graph.get(curr)!.values().next().value!;
      } while (curr !== v);

      // collapse cycle into a single self-loop node (pick representative)
      const rep = cycle[0];
      console.log('pure cycle', cycle);
      addEdge(rep, rep);
    }
  }

  normalizeGraph(result);
  return result;
}

function circularityByRadius(coords: [number, number][]) {
  // centroid
  const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;

  // center
  //const [cx, cy] = center(getExtent(coords));

  const distances = coords.map(pos => distance(pos, [cx, cy]));

  const mean = distances.reduce((s, d) => s + d, 0) / distances.length;

  const variance =
    distances.reduce((s, d) => s + (d - mean) ** 2, 0) / distances.length;

  const stdDev = Math.sqrt(variance);

  return {
    center: [cx, cy] as [number, number],
    meanRadius: mean,
    score: stdDev / mean, // 🔥 key metric
  };
}

function turningConsistency(coords: [number, number][]) {
  let positive = 0;
  let negative = 0;

  for (let i = 1; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i - 1];
    const [x2, y2] = coords[i];
    const [x3, y3] = coords[i + 1];

    const cross = (x2 - x1) * (y3 - y2) - (y2 - y1) * (x3 - x2);

    if (cross > 0) positive++;
    if (cross < 0) negative++;
  }

  const total = positive + negative;
  const dominant = Math.max(positive, negative);

  return {
    score: total === 0 ? 0 : dominant / total,
    direction: positive > negative ? 1 : positive === negative ? 0 : -1,
  };
}

export function detectPrefabRoundabouts(
  tsmapData: Pick<MappedData, 'prefabDescriptions'>,
): Set<string> {
  const results = new Set<string>();
  const { prefabDescriptions } = tsmapData;
  for (const desc of prefabDescriptions.values()) {
    if (circularityByRadius(desc.nodes.map(n => [n.x, n.y])).score > 0.35) {
      continue;
    }

    const connections = calculateNodeConnections(desc).values().toArray();
    const fullyConnectedRoundabout =
      connections.length >= 3 &&
      connections.every(exits => exits.length === connections.length);
    const mostlyConnectedRoundabout =
      connections.length >= 4 &&
      connections.every(exits => exits.length >= connections.length - 1) &&
      connections.filter(exits => exits.length === connections.length).length >=
        connections.length / 2;

    if (!fullyConnectedRoundabout && !mostlyConnectedRoundabout) {
      continue;
    }

    // get the path of the first-node-loopback.
    const laneInfo = calculateLaneInfo(desc);
    const path: [number, number][] = [];
    const turningCons: { score: number; direction: number }[] = [];
    for (const lane of laneInfo.values()) {
      for (const inputLane of lane) {
        for (const branch of inputLane.branches) {
          const interiorCurvePoints = branch.curvePoints.slice(
            Math.floor(branch.curvePoints.length / 3),
            -Math.floor(branch.curvePoints.length / 3),
          );
          turningCons.push(turningConsistency(interiorCurvePoints));

          path.push(...interiorCurvePoints);
          //}
        }
      }
    }
    const bounds = getExtent(path);
    const aspect =
      Math.abs(bounds[0] - bounds[2]) / Math.abs(bounds[1] - bounds[3]);

    const turning =
      turningCons.reduce((acc, i) => acc + i.score, 0) / turningCons.length;
    const score = {
      ...circularityByRadius(path),
      aspect,
      turning,
      conns: connections.length,
      allTurns: turningCons.every(s => s.direction === 1)
        ? 'positive'
        : turningCons.every(s => s.direction === -1)
          ? 'negative'
          : 'mixedOrZero',
    };
    if (
      Number(turning.toFixed(2)) < 0.79 ||
      score.meanRadius > 70 ||
      score.aspect < 0.7 ||
      score.aspect > 1.3
    ) {
      console.log('not circular enough', desc.path);
      console.log(desc.path, {
        ...score,
        scoreAdj: score.score / connections.length,
      });
      continue;
    } else if (!desc.path.includes('round')) {
      console.log('suspect', desc.path, {
        ...score,
        scoreAdj: score.score / connections.length,
      });
    } else {
      console.log('ok', desc.path, {
        ...score,
        scoreAdj: score.score / connections.length,
      });
    }
    results.add(desc.token);
  }
  console.log(results);
  return results;
}

type CompositeRoundabouts = Map<
  // ordered nodeUids of entry/exit nodes in a composite roundabout.
  // ordering is the same as that of prefab description nodes: clockwise.
  bigint[],
  ReturnType<typeof calculateLaneInfo>
>;

export function detectCompositeRoundabouts(
  graph: ReadonlyMap<bigint, Neighbors>,
  tsMapData: MappedDataForKeys<
    [
      'nodes',
      'roads',
      'prefabs',
      'companies',
      'ferries',
      'roadLooks',
      'prefabDescriptions',
      'ferries',
    ]
  >,
): Map<bigint[], Map<number, Lane[]>> {
  const toLngLat =
    tsMapData.map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;

  const res: CompositeRoundabouts = new Map();

  // 1. prune graph by removing nodes associated with prefab roundabouts.
  const roundaboutPrefabTokens = detectPrefabRoundabouts(tsMapData);
  const roundaboutPrefabNodeUids = new Set<bigint>(
    tsMapData.prefabs
      .values()
      .flatMap(prefab =>
        roundaboutPrefabTokens.has(prefab.token) ? prefab.nodeUids : [],
      ),
  );
  const prunedGraph = new Map(
    graph.entries().filter(([key]) => !roundaboutPrefabNodeUids.has(key)),
  );
  console.log(
    graph.size - prunedGraph.size,
    'prefab-roundbout nodes pruned from graph',
  );
  const roundaboutPrefabNodes = roundaboutPrefabNodeUids
    .values()
    .toArray()
    .filter(nid => tsMapData.nodes.has(nid))
    .map(nid => assertExists(tsMapData.nodes.get(nid)));
  //fs.writeFileSync(
  //  'roundabout-prefabs.geojson',
  //  JSON.stringify(
  //    featureCollection(
  //      roundaboutPrefabNodes.map(n => point(toLngLat([n.x, n.y]))),
  //    ),
  //    null,
  //    2,
  //  ),
  //  'utf-8',
  //);

  // 2. convert graph to adjacency list, collapse chains.
  const adjacencyList = convertToAdjacencyList(prunedGraph);
  normalizeGraph(adjacencyList);
  // enable collapsing for quicker debugging
  //adjacencyList = collapseDirectedChains(adjacencyList);

  // 3. cluster nodes by degrees >= 3, with a radius of 200m (in game units)
  const { inDeg, outDeg } = computeDegrees(adjacencyList);
  const possibleRoundaboutNodeUids = new Set<bigint>();
  let unknownNodeUids = 0;
  for (const key of adjacencyList.keys()) {
    const inDegrees = assertExists(inDeg.get(key));
    const outDegrees = assertExists(outDeg.get(key));
    if (!inDegrees || !outDegrees) {
      continue;
    }
    const totalDegrees = inDegrees + outDegrees;
    // N.B.: loosening to >= 2 increases detected clusters by 2%.
    if (totalDegrees >= 2) {
      const nodeUid = BigInt(key.split('-')[0]);
      if (tsMapData.nodes.has(nodeUid)) {
        possibleRoundaboutNodeUids.add(nodeUid);
      } else {
        unknownNodeUids++;
      }
    }
  }
  // TODO: why are there unknown node uids? hidden roads/prefabs?
  console.log(unknownNodeUids, 'unknown node uids');

  const nodeFeatures = featureCollection(
    possibleRoundaboutNodeUids
      .values()
      .toArray()
      .map(nodeUid => {
        const node = assertExists(tsMapData.nodes.get(nodeUid));
        return point(toLngLat([node.x, node.y]), {
          nodeUid: nodeUid.toString(),
        });
      }),
  );

  clustersDbscan(
    nodeFeatures,
    // ideally, scale factor should depend on map (and in ETS2 case: whether
    //  point is in UK). but it's ok to be looser with filtering at this stage.
    (200 * 20) / 1000, // kilometers
    { mutate: true },
  );
  const clusters = new Map<number, Set<bigint>>();
  for (const { properties } of nodeFeatures.features) {
    const clusterId = (properties as DbscanProps).cluster;
    if (clusterId != null) {
      putIfAbsent(clusterId, new Set(), clusters).add(
        BigInt(properties.nodeUid),
      );
    }
  }
  console.log(clusters.size, 'clusters');

  // 4. for each cluster, detect cycles
  const cycles: string[][] = [];
  for (const [clusterId, nodeUids] of clusters) {
    // build a graph of just the nodeUids
    const subGraph: AdjacencyList = new Map<string, Set<string>>();
    for (const nodeUid of nodeUids) {
      for (const direction of ['forward', 'backward']) {
        const key = `${nodeUid}-${direction}`;
        const neighbors = new Set<string>();
        const allNeighbors = adjacencyList.get(key) ?? new Set();
        for (const neighbor of allNeighbors) {
          const neighborNodeUid = BigInt(neighbor.split('-')[0]);
          if (nodeUids.has(neighborNodeUid)) {
            neighbors.add(neighbor);
          }
        }
        subGraph.set(key, neighbors);
      }
    }

    const simpleCycles = findAllSimpleCycles(subGraph, 4, 30);
    for (const cycle of simpleCycles) {
      const nodeUids = new Set(cycle.map(v => BigInt(v.split('-')[0])));
      const nodes = nodeUids
        .values()
        .toArray()
        .map(nid => assertExists(tsMapData.nodes.get(nid)));
      if (circularityByRadius(nodes.map(n => [n.x, n.y])).score > 0.35) {
        continue;
      }
      cycles.push(cycle);
    }
  }

  console.log(cycles.length, 'cycles');
  fs.writeFileSync('cycles.json', JSON.stringify(cycles, null, 2), 'utf-8');
  //throw new Error();

  // 5. filter cycles by cycle-path circularity and turning consistency
  filterCycles(cycles, graph, tsMapData);

  // 5a. verify that no sub-cycles exist

  // N.B.: cycles have the same start and end nodes in list.
  console.log(cycles[0]);

  // 6. build LaneInfo map for cycles

  // 7. FURTHER filter out cycles that involve 90-degree turns (to filter
  //    out a cycle that's really just a BOX and not a CIRCLE)

  // debug

  const uniqueNodeUids = new Set(
    cycles.flatMap(vertices => vertices.map(v => BigInt(v.split('-')[0]))),
  );
  const uniqueNodes = uniqueNodeUids
    .values()
    .toArray()
    .map(nid => assertExists(tsMapData.nodes.get(nid)));
  fs.writeFileSync(
    'roundabouts.geojson',
    JSON.stringify(
      featureCollection(uniqueNodes.map(n => point(toLngLat([n.x, n.y])))),
      null,
      2,
    ),
    'utf-8',
  );

  fs.writeFileSync(
    'clusters.geojson',
    JSON.stringify(
      featureCollection(
        nodeFeatures.features.filter(
          f => (f.properties as DbscanProps).cluster != null,
        ),
      ),
      null,
      2,
    ),
    'utf-8',
  );
  return res;
}

export function filterCycles(
  cycles: string[][],
  _graph: ReadonlyMap<bigint, Neighbors>,
  tsMapData: MappedDataForKeys<
    [
      'nodes',
      'roads',
      'prefabs',
      'companies',
      'ferries',
      'roadLooks',
      'prefabDescriptions',
      'ferries',
    ]
  >,
) {
  // N.B.: cycles have the same start and end nodes in list.
  console.log(cycles[0]);

  // TODO precalc this lookup. And consider merging Ferry & FerryItem types.
  const ferriesByUid = new Map<bigint, FerryItem>(
    tsMapData.ferries
      .values()
      .map(f => [f.uid, { ...f, type: ItemType.Ferry }]),
  );
  // TODO precalc this lookup
  const companiesByPrefab = new Map<bigint, CompanyItem>(
    tsMapData.companies.values().map(c => [c.prefabUid, c]),
  );
  const lookups = {
    ferriesByUid,
    companiesByPrefab,
  };

  const points: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const fails: GeoJSON.Feature<GeoJSON.Point>[] = [];

  for (const cycle of cycles) {
    const nodeUids = cycle.map(key => BigInt(key.split('-')[0]));
    const path = getLineString(nodeUids, tsMapData, lookups);
    const bounds = getExtent(path);
    const aspect =
      Math.abs(bounds[0] - bounds[2]) / Math.abs(bounds[1] - bounds[3]);

    const turning = turningConsistency(path);
    const score = {
      ...circularityByRadius(path),
      aspect,
      turning,
    };
    // 259 detected in ETS2
    if (
      turning.direction !== -1 ||
      Number(turning.score.toFixed(2)) < 0.79 ||
      score.meanRadius > 70 ||
      score.score > 0.075 ||
      Math.abs(1 - score.aspect) > 0.1
    ) {
      fails.push(
        point(fromEts2CoordsToWgs84(score.center), {
          meanRadius: score.meanRadius,
          score: score.score,
          aspect: score.aspect,
          turningScore: score.turning.score,
          turningDirection: score.turning.direction,
        }),
      );
    } else {
      points.push(
        point(fromEts2CoordsToWgs84(score.center), {
          meanRadius: score.meanRadius,
          score: score.score,
          aspect: score.aspect,
          turningScore: score.turning.score,
          turningDirection: score.turning.direction,
        }),
      );
    }
  }
  console.log({
    fails: fails.length,
    passes: points.length,
  });
  fs.writeFileSync(
    'failedCycles.geojson',
    JSON.stringify(featureCollection(fails), null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    'filteredCycles.geojson',
    JSON.stringify(featureCollection(points), null, 2),
    'utf-8',
  );
}

export function detectRoundabouts(
  graph: Map<bigint, Neighbors>,
  tsMapData: Pick<
    MappedData,
    'nodes' | 'prefabs' | 'prefabDescriptions' | 'map'
  >,
): Map<bigint, Neighbors> {
  let adjacencyList = convertToAdjacencyList(graph);
  normalizeGraph(adjacencyList);

  // filter graph to nodes that exist / are known (due to load-time filtering)
  let deletedCount = 0;
  for (const key of adjacencyList.keys()) {
    const nodeUid = BigInt(key.split('-')[0]);
    const node = tsMapData.nodes.get(nodeUid);
    if (!node) {
      graph.delete(nodeUid);
      deletedCount++;
    }
  }
  console.log('deleted', deletedCount, 'keys');

  // print out adjacency list edges
  adjacencyList = convertToAdjacencyList(graph);
  console.log(adjacencyList.size, 'nodes');
  let edges = 0;
  for (const neighbors of adjacencyList.values()) {
    edges += neighbors.size;
  }
  console.log(edges, 'edges');

  //adjacencyList = pruneDeadEnds(adjacencyList);

  console.log('collapsing....');
  //const graphAndRoundabouts = collapseDirectedChainsWithRoundabouts(
  //  adjacencyList,
  //  tsMapData,
  //);
  //adjacencyList = graphAndRoundabouts.graph;
  adjacencyList = collapseDirectedChains(adjacencyList);
  console.log(adjacencyList.size, 'nodes');
  let maxEdges = 0;
  edges = 0;
  for (const neighbors of adjacencyList.values()) {
    edges += neighbors.size;
    maxEdges = neighbors.size > maxEdges ? neighbors.size : maxEdges;
  }
  console.log(edges, 'edges');
  console.log(maxEdges, 'maxEdges');

  //console.log('collapsing AGAIN...');
  //const collapseRes = collapseDirectedChainsWithRoundabouts(
  //  adjacencyList,
  //  tsMapData,
  //);
  //console.log(collapseRes.graph.size, 'nodes');
  //edges = 0;
  //maxEdges = 0;
  //for (const neighbors of collapseRes.graph.values()) {
  //  edges += neighbors.size;
  //  maxEdges = neighbors.size > maxEdges ? neighbors.size : maxEdges;
  //}
  //console.log(edges, 'edges');
  //console.log(maxEdges, 'maxEdges');

  //console.log('roundabouts', collapseRes.roundabouts);

  /*
  for (const [key, adjs] of adjacencyList) {
    const nodeUid = BigInt(key.split('-')[0]);
    const nodeDir = key.split('-')[1];
    const node = tsMapData.nodes.get(nodeUid);
    if (!node) {
      continue;
    }

    for (const adj of adjs) {
      const adjUid = BigInt(adj.split('-')[0]);
      const adjDir = adj.split('-')[1];
      console.log(
        nodeUid.toString(16) + '-' + nodeDir,
        '->',
        `${adjUid.toString(16)}-${adjDir}`,
      );
    }
  }

   */

  const toLngLat =
    tsMapData.map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;

  const res = new Map<string, Set<string>>();

  //let sccs = findSCCsIterative1(mapValues(adjacencyList, v => [...v]));
  let sccs = findAllSimpleCycles(adjacencyList);
  //sccs = sccs.filter(component => component.length >= 4);

  console.log('components', sccs.length);

  sccs.forEach(components => {
    console.log(components.length);
    console.log(
      JSON.stringify(
        components.map(entry => {
          const uid = BigInt(entry.split('-')[0]);
          const dir = entry.split('-')[1];
          return uid.toString(16) + '-' + dir;
        }),
        null,
        2,
      ),
    );
  });

  sccs = sccs.filter(component => component.length >= 3);
  const nodeUids = sccs.map(component =>
    component.map(s => BigInt(s.split('-')[0])),
  );
  console.log('components', nodeUids.length);
  const coords: [number, number][] = [];
  for (const components of nodeUids) {
    const node = tsMapData.nodes.get(components[0]);
    if (!node) {
      continue;
    }
    const [lng, lat] = toLngLat([node.x, node.y]);
    const latlng = `${lat.toFixed(6)}/${lng.toFixed(6)}`;
    console.log(`http://localhost:5173/?mlat=${lat}&mlon=${lng}#14/${latlng}`);

    for (const c of components) {
      const node = tsMapData.nodes.get(c);
      if (!node) {
        continue;
      }
      const [lng, lat] = toLngLat([node.x, node.y]);
      coords.push([lng, lat]);
    }
  }
  //console.log(
  //  JSON.stringify(featureCollection(coords.map(c => point(c))), null, 2),
  //);
  //console.log(sccs);

  return convertToNeighbors(res, graph);
}

function findAllSimpleCycles(
  graph: AdjacencyList,
  minLen = 4,
  maxLen = 15,
): string[][] {
  const nodes = Array.from(graph.keys()).sort(); // stable ordering
  const indexMap = new Map(nodes.map((n, i) => [n, i]));

  const result: string[][] = [];

  const blocked = new Set<string>();
  const B = new Map<string, Set<string>>();
  for (const v of nodes) B.set(v, new Set());

  const path: string[] = [];

  function unblock(start: string) {
    const stack = [start];
    while (stack.length) {
      const v = stack.pop()!;
      if (blocked.has(v)) {
        blocked.delete(v);
        for (const w of B.get(v)!) {
          stack.push(w);
        }
        B.get(v)!.clear();
      }
    }
  }

  interface Frame {
    v: string;
    i: number;
    neighbors: string[];
    foundCycle: boolean;
  }

  for (let sIdx = 0; sIdx < nodes.length; sIdx++) {
    const s = nodes[sIdx];

    // Build subgraph with nodes >= s
    const subgraph = new Map<string, string[]>();
    for (let i = sIdx; i < nodes.length; i++) {
      const v = nodes[i];
      const filtered = (graph.get(v) ?? new Set())
        .values()
        .toArray()
        .filter(w => indexMap.get(w)! >= sIdx);
      subgraph.set(v, filtered);
    }

    // Reset state
    blocked.clear();
    for (const v of nodes) B.get(v)!.clear();

    const stack: Frame[] = [];

    stack.push({
      v: s,
      i: 0,
      neighbors: subgraph.get(s) ?? [],
      foundCycle: false,
    });

    path.length = 0;
    path.push(s);
    blocked.add(s);

    while (stack.length) {
      const frame = stack[stack.length - 1];
      const { v } = frame;

      if (frame.i < frame.neighbors.length) {
        const w = frame.neighbors[frame.i++];

        // Enforce max length before going deeper
        if (path.length >= maxLen) {
          continue;
        }

        if (w === s) {
          // Enforce minimum length
          if (path.length >= minLen) {
            result.push([...path, s]);
          }
          frame.foundCycle = true;
        } else if (!blocked.has(w)) {
          path.push(w);
          stack.push({
            v: w,
            i: 0,
            neighbors: subgraph.get(w) ?? [],
            foundCycle: false,
          });
          blocked.add(w);
        }
      } else {
        // Backtrack
        if (frame.foundCycle) {
          unblock(v);
        } else {
          for (const w of subgraph.get(v) ?? []) {
            B.get(w)!.add(v);
          }
        }

        stack.pop();
        path.pop();

        if (stack.length) {
          stack[stack.length - 1].foundCycle ||= frame.foundCycle;
        }
      }
    }
  }

  return result;
}

function convertToAdjacencyList(
  graph: Map<bigint, Neighbors>,
): Map<string, Set<string>> {
  const adjacencyList = new Map<string, Set<string>>();

  for (const [fromNodeUid, { forward, backward }] of graph) {
    for (const nodeDirection of ['forward', 'backward']) {
      const neighbors = nodeDirection === 'forward' ? forward : backward;
      const adjacents = new Set<string>();
      for (const { nodeUid, direction } of neighbors) {
        const toNode = `${nodeUid}-${direction}`;
        //const toNode = `${nodeUid}`;
        adjacents.add(toNode);
      }
      if (adjacents.size) {
        adjacencyList.set(`${fromNodeUid}-${nodeDirection}`, adjacents);
        //adjacencyList.set(`${nodeUid}`, adjacents);
      }
    }
  }

  return adjacencyList;
}

function convertToNeighbors(
  adjacencyList: Map<string, Set<string>>,
  context: Map<bigint, Neighbors>,
): Map<bigint, Neighbors> {
  const graph = new Map<bigint, Neighbors>();

  for (const [nodeKey, neighborKeys] of adjacencyList) {
    const [uidStr, direction] = nodeKey.split('-') as [
      string,
      'forward' | 'backward',
    ];
    const neighbors = putIfAbsent(
      BigInt(uidStr),
      {
        forward: [],
        backward: [],
      },
      graph,
    );

    const mutableNeighbors = neighbors as {
      forward: Neighbor[];
      backward: Neighbor[];
    };

    const contextNeighbors = assertExists(context.get(BigInt(uidStr)))[
      direction
    ];
    for (const neighborKey of neighborKeys) {
      const [nUidStr, nDirection] = neighborKey.split('-') as [
        string,
        'forward' | 'backward',
      ];
      const nUid = BigInt(nUidStr);
      const contextNeighbor = assertExists(
        contextNeighbors.find(
          neighbor =>
            neighbor.nodeUid === nUid && neighbor.direction === nDirection,
        ),
      );

      mutableNeighbors[direction].push(contextNeighbor);
    }
  }

  return graph;
}
