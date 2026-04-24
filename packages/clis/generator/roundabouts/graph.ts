// ensures that graph has a key for every edge's start + end nodes.
import { assert, assertExists } from '@truckermudgeon/base/assert';
import { putIfAbsent } from '@truckermudgeon/base/map';
import type { Neighbors } from '@truckermudgeon/map/types';

export type AdjacencyList = Map<string, Set<string>>;

export function normalizeGraph(graph: AdjacencyList) {
  for (const neighbors of graph.values()) {
    for (const v of neighbors) {
      if (!graph.has(v)) {
        graph.set(v, new Set());
      }
    }
  }
}

export function computeDegrees(graph: AdjacencyList): {
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

export function collapseDirectedChains(graph: AdjacencyList): AdjacencyList {
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

export function convertToAdjacencyList(
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
