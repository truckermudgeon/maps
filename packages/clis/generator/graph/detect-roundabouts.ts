import { assertExists } from '@truckermudgeon/base/assert';
import { mapValues, putIfAbsent } from '@truckermudgeon/base/map';
import type { MappedData } from '@truckermudgeon/io';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type { Neighbor, Neighbors } from '@truckermudgeon/map/types';

export function detectRoundabouts(
  graph: Map<bigint, Neighbors>,
  tsMapData: Pick<MappedData, 'nodes' | 'map'>,
): Map<bigint, Neighbors> {
  const adjacencyList = convertToAdjacencyList(graph);
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

  let sccs = findSCCsIterative1(mapValues(adjacencyList, v => [...v]));
  //console.log(sccs);

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
