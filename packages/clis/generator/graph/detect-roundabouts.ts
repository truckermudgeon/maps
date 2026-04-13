import { assertExists } from '@truckermudgeon/base/assert';
import { putIfAbsent } from '@truckermudgeon/base/map';
import type { Neighbor, Neighbors } from '@truckermudgeon/map/types';

export function detectRoundabouts(
  graph: Map<bigint, Neighbors>,
): Map<bigint, Neighbors> {
  const adjacencyList = convertToAdjacencyList(graph);

  const res = new Map<string, Set<string>>();

  const sccs = findSCCs(adjacencyList);
  console.log(sccs);

  return convertToNeighbors(res, graph);
}

// Tarjan
function findSCCs(graph: Map<string, Set<string>>): string[][] {
  let index = 0;
  const stack: string[] = [];
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const result: string[][] = [];

  function strongconnect(v: string) {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;

    stack.push(v);
    onStack.add(v);

    for (const w of graph.get(v) ?? []) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string;

      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);

      result.push(component);
    }
  }

  for (const v of graph.keys()) {
    if (!indices.has(v)) {
      strongconnect(v);
    }
  }

  return result;
}

function convertToAdjacencyList(
  graph: Map<bigint, Neighbors>,
): Map<string, Set<string>> {
  const adjacencyList = new Map<string, Set<string>>();

  for (const [nodeUid, { forward, backward }] of graph) {
    for (const nodeDirection of ['forward', 'backward']) {
      const adjacents = new Set<string>();
      const neighbors = nodeDirection === 'forward' ? forward : backward;
      for (const { nodeUid, direction } of neighbors) {
        const toNode = `${nodeUid}-${direction}`;
        adjacents.add(toNode);
      }
      if (adjacents.size) {
        adjacencyList.set(`${nodeUid}-${nodeDirection}`, adjacents);
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
