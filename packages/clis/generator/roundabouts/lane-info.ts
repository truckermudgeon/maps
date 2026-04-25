import { assertExists } from '@truckermudgeon/base/assert';
import type { MappedDataForKeys } from '@truckermudgeon/io';
import type { AdjacencyList } from './graph';
import { keyToNodeUid } from './graph';

export interface AccessPoint {
  type: 'entrance' | 'exit';
  nodeUid: bigint;
}

export type RoundaboutLaneInfo = Map<
  // entrance
  bigint,
  // exit
  Map<
    bigint,
    {
      // index of exit, relative to entrance
      exitIndex: number;
      // nodes between entrance and exit
      innerNodes: bigint[];
    }
  >
>;

export function calculateLaneInfo(
  cycle: string[],
  context: {
    tsMapData: MappedDataForKeys<
      ['nodes', 'roads', 'prefabs', 'prefabDescriptions']
    >;
    adjacencyList: AdjacencyList;
    degrees: {
      inDeg: Map<string, number>;
      outDeg: Map<string, number>;
    };
  },
): RoundaboutLaneInfo {
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

  console.log({
    first: keyToNodeUid(cycle[0]).toString(16),
    withEntrances: withEntrances.map(keyToNodeUid),
    withExits: withExits.map(keyToNodeUid),
    entrances: entrances.map(keyToNodeUid).map(n => n.toString(16)),
    exits: exits.map(keyToNodeUid).map(n => n.toString(16)),
  });

  throw new Error('done');
}
