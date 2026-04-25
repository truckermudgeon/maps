import { assertExists } from '@truckermudgeon/base/assert';
import { getExtent, toRadians } from '@truckermudgeon/base/geom';
import { putIfAbsent } from '@truckermudgeon/base/map';
import type { MapDataKeys, MappedDataForKeys } from '@truckermudgeon/io';
import { writeGeojsonFile } from '@truckermudgeon/io';
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
import { findAllSimpleCycles } from './cycles';
import type { AdjacencyList } from './graph';
import {
  collapseDirectedChains,
  computeDegrees,
  convertToAdjacencyList,
  keyToNodeUid,
} from './graph';
import { detectPrefabRoundabouts } from './prefab-roundabouts';
import {
  aspectRatioScore,
  circularityByRadius,
  meanRadiusScore,
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
  tsMapData: MappedDataForKeys<typeof detectRoundaboutsMapDataKeys>,
  options: { writeDebugFiles: boolean } = { writeDebugFiles: false },
): Map<bigint[], Map<number, Lane[]>> {
  const toLngLat =
    tsMapData.map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;

  // 1. prune graph by removing nodes associated with:
  // - prefab roundabouts
  // - prefabs containing a straight line and a 90-degree turn
  const roundaboutPrefabTokens = detectPrefabRoundabouts(tsMapData);
  const toleranceRadians = toRadians(5);
  const tOrXIntersectionPrefabTokens = new Set(
    [...tsMapData.prefabDescriptions.values()]
      .filter(prefabDesc => {
        const branches = [...calculateLaneInfo(prefabDesc).values()].flatMap(
          lanes => lanes.flatMap(lane => lane.branches),
        );
        const straight = branches.some(
          branch => Math.abs(branch.angle) < toleranceRadians,
        );
        const ninety = branches.some(
          branch => Math.PI / 2 - Math.abs(branch.angle) < toleranceRadians,
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

  const prefabNodeUids = new Set<bigint>(
    [...tsMapData.prefabs.values()]
      .filter(
        prefab =>
          roundaboutPrefabTokens.has(prefab.token) ||
          tOrXIntersectionPrefabTokens.has(prefab.token),
      )
      .flatMap(prefab => prefab.nodeUids),
  );
  const prunedGraph = new Map(
    graph.entries().filter(([key]) => !prefabNodeUids.has(key)),
  );
  logger.info(
    graph.size - prunedGraph.size,
    'roundabout and T/X prefab nodes pruned from graph',
  );

  // 2. convert graph to adjacency list
  const adjacencyList = convertToAdjacencyList(prunedGraph);
  const { graph: collapsedAdjacencyList, collapsedEdges } =
    collapseDirectedChains(adjacencyList);
  //const collapsedAdjacencyList = adjacencyList;
  //const collapsedEdges = new Map();

  // 3. cluster nodes by degrees >= 3, with a radius of 200m (in game units)
  const { inDeg, outDeg } = computeDegrees(collapsedAdjacencyList);
  const possibleCompositeRoundaboutNodeUids = new Set<bigint>();
  let unknownNodeUids = 0;
  for (const key of collapsedAdjacencyList.keys()) {
    const inDegrees = assertExists(inDeg.get(key));
    const outDegrees = assertExists(outDeg.get(key));
    if (!inDegrees || !outDegrees) {
      // ignore one-way nodes
      continue;
    }
    const totalDegrees = inDegrees + outDegrees;
    if (totalDegrees >= 2) {
      const nodeUid = keyToNodeUid(key);
      if (tsMapData.nodes.has(nodeUid)) {
        possibleCompositeRoundaboutNodeUids.add(nodeUid);
      } else {
        unknownNodeUids++;
      }
    }
  }
  // TODO: why are there unknown node uids? hidden roads/prefabs?
  if (unknownNodeUids) {
    logger.warn(unknownNodeUids, 'unknown node uids');
  }

  const nodeFeatures = featureCollection(
    [...possibleCompositeRoundaboutNodeUids].map(nodeUid => {
      const node = assertExists(tsMapData.nodes.get(nodeUid));
      return point(toLngLat([node.x, node.y]), {
        nodeUid: nodeUid.toString(16),
      });
    }),
  );

  const startTime = Date.now();
  logger.start('clustering', nodeFeatures.features.length, 'nodes...');
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
        BigInt('0x' + properties.nodeUid),
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
  for (const [clusterId, collapsedClusterNodeUids] of clusters) {
    bar.increment();
    // build a graph of just the nodeUids
    const subGraph: AdjacencyList = new Map<string, Set<string>>();
    const addEdge = (a: string, b: string) =>
      putIfAbsent(a, new Set(), subGraph).add(b);

    for (const startNode of collapsedClusterNodeUids) {
      for (const direction of ['forward', 'backward']) {
        const startKey = `${startNode}-${direction}`;
        const allNeighbors = collapsedAdjacencyList.get(startKey) ?? new Set();
        for (const endKey of allNeighbors) {
          const neighborNodeUid = keyToNodeUid(endKey);
          if (collapsedClusterNodeUids.has(neighborNodeUid)) {
            const intermediaryKeys =
              collapsedEdges.get(`${startKey}-${endKey}`) ?? [];
            for (const interKeys of intermediaryKeys) {
              let currKey = startKey;
              for (const interKey of interKeys) {
                addEdge(currKey, interKey);
                currKey = interKey;
              }
              addEdge(currKey, endKey);
            }
          }
        }
      }
    }

    const simpleCycles = findAllSimpleCycles(subGraph, 4, 30);
    for (const cycle of simpleCycles) {
      const nodeUids = new Set(cycle.map(keyToNodeUid));
      const nodes = [...nodeUids].map(nid =>
        assertExists(tsMapData.nodes.get(nid)),
      );
      if (circularityByRadius(nodes.map(n => [n.x, n.y])).score > 0.35) {
        continue;
      }
      cycles.push(cycle);
    }
  }

  logger.success(cycles.length, 'cycles found');

  // 5. filter cycles by cycle-path circularity and turning consistency
  const roundaboutCycles = filterCycles(cycles, tsMapData, options);

  // 6. build LaneInfo map for cycles
  const res: CompositeRoundabouts = new Map();

  // 7. FURTHER filter out cycles that have only one entrance + one exit, and
  //    the entry + exit share the same node (to filter out "courts").

  // debug

  if (options.writeDebugFiles) {
    logger.log('writing cluster debug geojson files');
    const uniqueNodeUids = new Set(
      roundaboutCycles.flatMap(vertices => vertices.map(keyToNodeUid)),
    );
    const uniqueNodes = [...uniqueNodeUids].map(nid =>
      assertExists(tsMapData.nodes.get(nid)),
    );
    writeGeojsonFile(
      `${tsMapData.map}-roundabouts.geojson`,
      featureCollection(uniqueNodes.map(n => point(toLngLat([n.x, n.y])))),
    );
    writeGeojsonFile(
      `${tsMapData.map}-clusters.geojson`,
      featureCollection(
        nodeFeatures.features.filter(
          f => (f.properties as DbscanProps).cluster != null,
        ),
      ),
    );
  }

  return res;
}

export function filterCycles(
  cycles: string[][],
  tsMapData: MappedDataForKeys<typeof detectRoundaboutsMapDataKeys>,
  options: { writeDebugFiles: boolean } = { writeDebugFiles: false },
): string[][] {
  const toLngLat =
    tsMapData.map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;

  // N.B.: cycles have the same start and end nodes in list.
  const results: string[][] = [];

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

  const passes: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const fails: GeoJSON.Feature<GeoJSON.Point>[] = [];

  for (const cycle of cycles) {
    const nodeUids = cycle.map(keyToNodeUid);
    const hasAdjacent = nodeUids.some((item, i) => item === nodeUids[i + 1]);
    if (hasAdjacent) {
      // wonky cycle; skip it.
      continue;
    }

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

    const compositeScore = calculateScore(score);
    const centerPoint = point(toLngLat(score.center), {
      meanRadius: score.meanRadius,
      score: score.score,
      aspect: score.aspect,
      turningScore: score.turning.score,
      turningDirection: score.turning.direction,
      compositeScore,
    });

    // 340 roundabouts in ETS2
    if (compositeScore < 0.55) {
      fails.push(centerPoint);
    } else {
      results.push(cycle);
      passes.push(centerPoint);
    }
  }
  logger.info('cycle classification:', {
    passes: passes.length,
    fails: fails.length,
  });

  if (options.writeDebugFiles) {
    logger.log('writing cycle debug json, geojson files');
    writeGeojsonFile(
      `${tsMapData.map}-failedCycles.geojson`,
      featureCollection(fails),
    );
    writeGeojsonFile(
      `${tsMapData.map}-filteredCycles.geojson`,
      featureCollection(passes),
    );
    writeGeojsonFile(
      `${tsMapData.map}-suspect.geojson`,
      featureCollection(
        passes.filter(
          p =>
            (p.properties as { compositeScore: number }).compositeScore < 0.65,
        ),
      ),
    );
    fs.writeFileSync(
      `${tsMapData.map}-cycles.json`,
      JSON.stringify(results, null, 2),
      'utf-8',
    );
  }

  return results;
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

  const radiusScore = meanRadiusScore(score.meanRadius);
  const aspectScore = aspectRatioScore(score.aspect);
  const turningScore = score.turning.score;
  const circularityScore = 1 - score.score;

  return radiusScore * aspectScore * turningScore * circularityScore;
}
