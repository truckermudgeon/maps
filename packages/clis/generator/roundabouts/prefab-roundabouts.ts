import { getExtent } from '@truckermudgeon/base/geom';
import type { MappedData } from '@truckermudgeon/io';
import {
  calculateLaneInfo,
  calculateNodeConnections,
} from '@truckermudgeon/map/prefabs';
import { circularityByRadius, turningConsistency } from './scoring';

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
      //console.log('not circular enough', desc.path);
      //console.log(desc.path, {
      //  ...score,
      //  scoreAdj: score.score / connections.length,
      //});
      continue;
    } else if (!desc.path.includes('round')) {
      //console.log('suspect', desc.path, {
      //  ...score,
      //  scoreAdj: score.score / connections.length,
      //});
    } else {
      //console.log('ok', desc.path, {
      //  ...score,
      //  scoreAdj: score.score / connections.length,
      //});
    }
    results.add(desc.token);
  }
  //console.log(results);
  return results;
}
