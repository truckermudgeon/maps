import { assert, assertExists } from '@truckermudgeon/base/assert';
import { mapValues, putIfAbsent } from '@truckermudgeon/base/map';
import type { MappedData } from '@truckermudgeon/io';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type { Neighbor, Neighbors } from '@truckermudgeon/map/types';

type Graph = Map<string, Set<string>>;

function normalizeGraph(graph: Graph) {
  for (const neighbors of graph.values()) {
    for (const v of neighbors) {
      if (!graph.has(v)) {
        graph.set(v, new Set());
      }
    }
  }
}

function computeDegrees(graph: Graph): {
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

function pruneDeadEnds(graph: Graph): Graph {
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

function collapseDirectedChains(graph: Graph): Graph {
  const { inDeg, outDeg } = computeDegrees(graph);

  const isChainNode = (v: string) =>
    (inDeg.get(v) ?? 0) === 1 && (outDeg.get(v) ?? 0) === 1;

  const result: Graph = new Map();
  const visited = new Set<string>();
  const emptySet: ReadonlySet<string> = new Set();

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

export function detectRoundabouts(
  graph: Map<bigint, Neighbors>,
  tsMapData: Pick<MappedData, 'nodes' | 'map'>,
): Map<bigint, Neighbors> {
  let adjacencyList = convertToAdjacencyList(graph);
  normalizeGraph(adjacencyList);

  // filter graph to nodes that exist / are known (due to load-time filtering)
  let deletedCount = 0;
  for (const [key, adjs] of adjacencyList) {
    const nodeUid = BigInt(key.split('-')[0]);
    const nodeDir = key.split('-')[1];
    const node = tsMapData.nodes.get(nodeUid);
    if (!node) {
      graph.delete(nodeUid);
      deletedCount++;
      continue;
    }

    for (const adj of adjs) {
      const adjUid = BigInt(adj.split('-')[0]);
      const adjDir = adj.split('-')[1];
      //console.log(
      //  nodeUid.toString(16) + '-' + nodeDir,
      //  '->',
      //  `${adjUid.toString(16)}-${adjDir}`,
      //);
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

  const toLngLat =
    tsMapData.map === 'usa' ? fromAtsCoordsToWgs84 : fromEts2CoordsToWgs84;

  const res = new Map<string, Set<string>>();

  //let sccs = findSCCsIterative1(mapValues(adjacencyList, v => [...v]));
  let sccs = findAllSimpleCycles(mapValues(adjacencyList, v => [...v]));
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

// Tarjan
export function findSCCsIterative1(graph: Map<string, string[]>): string[][] {
  let index = 0;

  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];

  const result: string[][] = [];

  interface Frame {
    node: string;
    parent?: string;
    neighborIndex: number;
  }

  for (const startNode of graph.keys()) {
    if (indices.has(startNode)) continue;

    const callStack: Frame[] = [];
    callStack.push({ node: startNode, neighborIndex: 0 });

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];
      const { node } = frame;

      // First time visiting node
      if (!indices.has(node)) {
        indices.set(node, index);
        lowlink.set(node, index);
        index++;

        stack.push(node);
        onStack.add(node);
      }

      const neighbors = graph.get(node) ?? [];

      if (frame.neighborIndex < neighbors.length) {
        const neighbor = neighbors[frame.neighborIndex];
        frame.neighborIndex++;

        if (!indices.has(neighbor)) {
          // Recurse (push new frame)
          callStack.push({
            node: neighbor,
            parent: node,
            neighborIndex: 0,
          });
        } else if (onStack.has(neighbor)) {
          // Back edge
          lowlink.set(
            node,
            Math.min(lowlink.get(node)!, indices.get(neighbor)!),
          );
        }
      } else {
        // Done exploring neighbors → backtrack
        callStack.pop();

        if (frame.parent != null) {
          const parent = frame.parent;

          lowlink.set(
            parent,
            Math.min(lowlink.get(parent)!, lowlink.get(node)!),
          );
        }

        // Root of SCC
        if (lowlink.get(node) === indices.get(node)) {
          const component: string[] = [];
          let w: string;

          do {
            w = stack.pop()!;
            onStack.delete(w);
            component.push(w);
          } while (w !== node);

          result.push(component);
        }
      }
    }
  }

  return result;
}

function findAllSimpleCycles(
  graph: Map<string, string[]>,
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
      const filtered = (graph.get(v) ?? []).filter(
        w => indexMap.get(w)! >= sIdx,
      );
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
