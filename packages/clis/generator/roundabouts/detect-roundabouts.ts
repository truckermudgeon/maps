import { assertExists } from '@truckermudgeon/base/assert';
import { getExtent, toRadians } from '@truckermudgeon/base/geom';
import { putIfAbsent } from '@truckermudgeon/base/map';
import type {
  MapDataKeys,
  MappedData,
  MappedDataForKeys,
} from '@truckermudgeon/io';
import { ItemType } from '@truckermudgeon/map/constants';
import { getLineString } from '@truckermudgeon/map/linestring';
import type { Lane } from '@truckermudgeon/map/prefabs';
import { calculateLaneInfo } from '@truckermudgeon/map/prefabs';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type {
  CompanyItem,
  FerryItem,
  Neighbors,
} from '@truckermudgeon/map/types';
import type { DbscanProps } from '@turf/clusters-dbscan';
import { clustersDbscan } from '@turf/clusters-dbscan';
import { featureCollection, point } from '@turf/helpers';
import * as cliProgress from 'cli-progress';
import fs from 'fs';
import type { GeoJSON } from 'geojson';
import { logger } from '../logger';
import type { AdjacencyList } from './graph';
import {
  collapseDirectedChains,
  computeDegrees,
  convertToAdjacencyList,
  normalizeGraph,
} from './graph';
import { detectPrefabRoundabouts } from './prefab-roundabouts';
import {
  aspectRatioScore,
  circularityByRadius,
  turningConsistency,
} from './scoring';

export const detectRoundaboutsMapDataKeys = [
  'nodes',
  'roads',
  'roadLooks',
  'prefabs',
  'prefabDescriptions',
  'companies',
  'companyDefs',
  'ferries',
] satisfies MapDataKeys;

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

  // 1. prune graph by removing nodes associated with:
  // - prefab roundabouts
  // - prefabs containing a straight line and a 90-degree turn
  const roundaboutPrefabTokens = detectPrefabRoundabouts(tsMapData);
  const toleranceRadians = toRadians(5);
  const tOrXIntersectionPrefabTokens = new Set(
    tsMapData.prefabDescriptions
      .values()
      .toArray()
      .filter(prefabDesc => {
        const laneInfo = [...calculateLaneInfo(prefabDesc).values()];
        const straight = laneInfo.some(lanes =>
          lanes.some(lane =>
            lane.branches.some(
              branch => Math.abs(branch.angle) < toleranceRadians,
            ),
          ),
        );
        const ninety = laneInfo.some(lanes =>
          lanes.some(lane =>
            lane.branches.some(
              branch =>
                Math.abs(Math.abs(branch.angle) - Math.PI / 2) <
                toleranceRadians,
            ),
          ),
        );
        return straight && ninety;
      })
      .map(prefabDesc => prefabDesc.token),
  );
  logger.info(roundaboutPrefabTokens.size, 'roundabout prefab tokens');
  logger.info(
    tOrXIntersectionPrefabTokens.size,
    'T- or X-intersection prefab tokens',
  );

  const roundaboutPrefabNodeUids = new Set<bigint>(
    tsMapData.prefabs
      .values()
      .flatMap(prefab =>
        roundaboutPrefabTokens.has(prefab.token) ||
        tOrXIntersectionPrefabTokens.has(prefab.token)
          ? prefab.nodeUids
          : [],
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

  const startTime = Date.now();
  logger.start(
    'clustering',
    nodeFeatures.features.length,
    'nodes... (this may take a while)',
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
  logger.success(
    clusters.size,
    'clusters in',
    Number(((Date.now() - startTime) / 1000).toFixed(1)),
    'seconds',
  );

  // 4. for each cluster, detect cycles
  logger.start('checking', clusters.size, 'clusters for cycles');
  const bar = new cliProgress.SingleBar(
    {
      format: `[{bar}] | {value} of {total}`,
      stopOnComplete: true,
      clearOnComplete: true,
    },
    cliProgress.Presets.rect,
  );
  bar.start(clusters.size, 0);

  const cycles: string[][] = [];
  for (const [clusterId, nodeUids] of clusters) {
    bar.increment();
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
    const compositeScore = calculateScore(score);
    if (compositeScore < 0.65) {
      fails.push(
        point(fromEts2CoordsToWgs84(score.center), {
          meanRadius: score.meanRadius,
          score: score.score,
          aspect: score.aspect,
          turningScore: score.turning.score,
          turningDirection: score.turning.direction,
          compositeScore,
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
          compositeScore,
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

// [0, 1]. the higher, the better.
function calculateScore(score: {
  meanRadius: number;
  score: number;
  aspect: number;
  turning: { score: number; direction: -1 | 0 | 1 };
}): number {
  if (score.turning.direction !== -1) {
    return 0;
  }

  if (score.meanRadius > 80) {
    return 0;
  }

  const aspectScore = aspectRatioScore(score.aspect);
  const turningScore = score.turning.score;
  const circularityScore = 1 - score.score;
  return aspectScore * turningScore * circularityScore;
}

export function detectRoundabouts(
  graph: Map<bigint, Neighbors>,
  tsMapData: Pick<
    MappedData,
    'nodes' | 'prefabs' | 'prefabDescriptions' | 'map'
  >,
) {
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
