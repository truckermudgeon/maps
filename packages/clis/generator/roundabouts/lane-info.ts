import { rotateFromIndex } from '@truckermudgeon/base/array';
import { assertExists } from '@truckermudgeon/base/assert';
import {
  angleBetweenVectors,
  centroid,
  toRadians,
} from '@truckermudgeon/base/geom';
import { putIfAbsent } from '@truckermudgeon/base/map';
import { Preconditions } from '@truckermudgeon/base/precon';
import type { MappedDataForKeys } from '@truckermudgeon/io';
import type { RoundaboutDesc, RoundaboutExit } from '@truckermudgeon/map/types';
import type { AdjacencyList } from './graph';
import { keyToNodeUid } from './graph';

export interface LaneInfoContext {
  tsMapData: MappedDataForKeys<['nodes']>;
  adjacencyList: AdjacencyList;
  degrees: {
    inDeg: Map<string, number>;
    outDeg: Map<string, number>;
  };
}

export function calculateLaneInfo(
  cycle: string[],
  context: LaneInfoContext,
): RoundaboutDesc {
  Preconditions.checkArgument(
    cycle.length >= 3,
    'cycle must have at least 3 items',
  );
  Preconditions.checkArgument(
    cycle[0] === cycle.at(-1),
    'cycle must start and end with same vertex',
  );
  cycle = cycle.slice(0, -1);
  const { tsMapData, adjacencyList, degrees } = context;

  // an entrance is an incoming neighbor of a node with inDeg >= 2, that is
  // *not* in `cycle`.
  const withEntrances = cycle.filter(
    vertex => assertExists(degrees.inDeg.get(vertex)) >= 2,
  );
  const entrances = withEntrances.map(key => {
    const neighbors = [...adjacencyList.entries()]
      .filter(([source, dests]) => dests.has(key) && !cycle.includes(source))
      .map(([key]) => key);
    return assertExists(neighbors[0]);
  });

  // an exit is an outgoing neighbor of a node with outDeg >= 2, that is
  // *not* in `cycle`.
  const withExits = cycle.filter(
    vertex => assertExists(degrees.outDeg.get(vertex)) >= 2,
  );
  const exits = withExits.map(key => {
    const neighbors = assertExists(adjacencyList.get(key));
    const exit = [...neighbors].find(vertex => !cycle.includes(vertex));
    return assertExists(exit);
  });

  const cycleNodes = cycle.map(key => {
    const nodeUid = keyToNodeUid(key);
    return assertExists(tsMapData.nodes.get(nodeUid));
  });
  const cycleCenter = centroid(cycleNodes);

  const paths: RoundaboutDesc['paths'] = new Map();
  for (let i = 0; i < withEntrances.length; i++) {
    const withEntrance = withEntrances[i];
    const withEntranceIndex = cycle.indexOf(withEntrance);
    const rotated = rotateFromIndex(cycle, withEntranceIndex);

    const entranceNode = assertExists(
      tsMapData.nodes.get(keyToNodeUid(entrances[i])),
    );

    let exitIndex = 0;
    for (const node of rotated) {
      const exitNodeIndex = withExits.indexOf(node);
      if (exitNodeIndex === -1) {
        continue;
      }

      const exitNode = assertExists(
        tsMapData.nodes.get(keyToNodeUid(exits[exitNodeIndex])),
      );

      //console.log({
      //  entrance: entranceNode.uid.toString(16),
      //  exit: exitNode.uid.toString(16),
      //  exitIndex,
      //  innerNodes: rotated
      //    .slice(0, rotated.indexOf(node) + 1)
      //    .map(k => keyToNodeUid(k).toString(16)),
      //  angleDeg: toDegrees(
      //    angleBetweenVectors(
      //      [entranceNode, cycleCenter],
      //      [cycleCenter, exitNode],
      //    ),
      //  ),
      //});

      putIfAbsent(
        entranceNode.uid,
        new Map<bigint, RoundaboutExit>(),
        paths,
      ).set(exitNode.uid, {
        exitIndex,
        rotateStartIndex: withEntranceIndex,
        numInnerNodes: rotated.indexOf(node) + 1,
        // TODO consider tweaking this, e.g., extending the exitNode point
        //  so that angles are less harsh. in the meantime: just add an offset.
        angle:
          angleBetweenVectors(
            [entranceNode, cycleCenter],
            [cycleCenter, exitNode],
          ) - toRadians(40),
      });

      exitIndex++;
    }
  }

  return {
    cycleNodeUids: cycle.map(keyToNodeUid),
    paths,
  };
}
