import { putIfAbsent } from '@truckermudgeon/base/map';
import { readGraphData, readMapData } from '@truckermudgeon/io';
import type { GraphData, Neighbor } from '@truckermudgeon/map/types';
import fs from 'fs';
import path from 'path';
import url from 'url';
import {
  detectCompositeRoundabouts,
  detectRoundaboutsMapDataKeys,
} from '../composite-roundabouts';

describe('roundabout detection', () => {
  it('detects SCCs (full graph)', () => {
    const map = 'europe';
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const outDir = path.join(__dirname, '../../../../../out');
    const graphData = readGraphData(outDir, map);
    const tsMapData = readMapData(outDir + '/parser', map, {
      mapDataKeys: detectRoundaboutsMapDataKeys,
      //focus: { city: 'paris', radiusMeters: 5000, type: 'city' },
      //focus: { type: 'coords', radiusMeters: 2000, coords: [-27400, 7500] },
      //focus: { city: 'sacramento', radiusMeters: 2000, type: 'city' },
    });

    const start = Date.now();
    //detectPrefabRoundabouts(tsMapData);
    detectCompositeRoundabouts(graphData.graph, tsMapData);
    const cycles = JSON.parse(
      fs.readFileSync('cycles.json', 'utf-8'),
    ) as string[][];
    //filterCycles(cycles, graphData.graph, tsMapData);

    //detectRoundabouts(graphData.graph, nodes);
    console.log('time', (Date.now() - start) / 1000, 'seconds');
  }, 600);

  it('detects SCCs demo', () => {
    const forwardOnlyGraph: GraphData['graph'] = new Map();
    const addEdge = (from: number, to: number) =>
      addDirectedEdge(forwardOnlyGraph, 'forward', from, to);

    addEdge(0, 1);
    addEdge(1, 2);
    addEdge(1, 7);
    addEdge(2, 3);
    addEdge(2, 6);
    addEdge(3, 4);
    addEdge(4, 2);
    addEdge(4, 5);
    addEdge(6, 3);
    addEdge(6, 5);
    addEdge(7, 0);
    addEdge(7, 6);

    //const roundabouts = detectRoundabouts(forwardOnlyGraph, {
    //  nodes: new Map(),
    //  map: 'usa',
    //});
  });

  it('detects SCCs demo', () => {
    const forwardOnlyGraph: GraphData['graph'] = new Map();
    const addEdge = (from: number, to: number) =>
      addDirectedEdge(forwardOnlyGraph, 'forward', from, to);

    /*
    var g = [][]int{
    0: {1},
    2: {0},
    5: {2, 6},
    6: {5},
    1: {2},
    3: {1, 2, 4},
    4: {5, 3},
    7: {4, 7, 6},
}
     */

    addEdge(0, 1);
    addEdge(2, 0);
    addEdge(5, 2);
    addEdge(5, 6);
    addEdge(6, 5);
    addEdge(1, 2);
    addEdge(3, 1);
    addEdge(3, 2);
    addEdge(3, 4);
    addEdge(4, 5);
    addEdge(4, 3);
    addEdge(7, 4);
    addEdge(7, 7);
    addEdge(7, 6);

    //const roundabouts = detectRoundabouts(forwardOnlyGraph, {
    //  nodes: new Map(),
    //  map: 'usa',
    //});
  });

  it('detects SCCs hardcoded', () => {
    const forwardOnlyGraph: GraphData['graph'] = new Map();
    const addEdge = (from: number, to: number) =>
      addDirectedEdge(forwardOnlyGraph, 'forward', from, to);
    const a = 0;
    const b = 1;
    const c = 2;
    const d = 3;
    const e = 4;
    const f = 5;
    const g = 6;
    const h = 7;
    const i = 8;
    const j = 9;
    const k = 10;
    const l = 11;

    addEdge(l, b);
    addEdge(l, a);
    addEdge(a, b);

    addEdge(b, c);

    addEdge(c, d);
    addEdge(c, e);
    addEdge(d, e);

    addEdge(e, f);

    addEdge(f, g);
    addEdge(f, h);
    addEdge(g, h);

    addEdge(h, i);

    addEdge(i, j);
    addEdge(i, k);
    addEdge(j, k);

    addEdge(k, l);

    //const roundabouts = detectRoundabouts(forwardOnlyGraph, {
    //  nodes: new Map(),
    //  map: 'usa',
    //});
  });
});

function addDirectedEdge(
  graph: GraphData['graph'],
  direction: 'forward' | 'backward',
  from: number,
  to: number,
) {
  const neighbors = putIfAbsent(
    BigInt(from),
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

  mutableNeighbors[direction].push(
    aNeighborWith({
      nodeUid: BigInt(to),
      direction,
    }),
  );
}

function aNeighborWith(
  neighbor: Partial<Neighbor> & { nodeUid: bigint },
): Neighbor {
  return {
    distance: 0,
    duration: 0,
    dlcGuard: 0,
    direction: 'forward',
    ...neighbor,
  };
}
