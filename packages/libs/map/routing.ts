import { assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type { Neighbor, Neighbors, Node } from '@truckermudgeon/map/types';
import TinyQueue from 'tinyqueue';

export type Direction = 'forward' | 'backward';
export type Mode = 'fastest' | 'shortest' | 'smallRoads';
export const routingModes = new Set<Mode>([
  'fastest',
  'shortest',
  'smallRoads',
]);
export type Route = {
  key: string;
  mode: Mode;
} & (
  | {
      success: true;
      route: Neighbor[];
      distance: number;
      duration: number;
      /** the lower, the better. */
      score: number;
    }
  | {
      success: false;
      numIters: number;
    }
);

export type PartialNode = Pick<Node, 'x' | 'y'>;
export interface Context {
  nodeLUT: ReadonlyMap<bigint, PartialNode>;
  graph: ReadonlyMap<bigint, Neighbors>;
  enabledDlcGuards: ReadonlySet<number>;
}

export type RouteKey = `${string}-${string}-${Direction}-${Mode}`;

export function assertRouteKey(key: string): RouteKey {
  const [startNodeUid, endNodeUid, direction, mode] = key.split('-');
  Preconditions.checkExists(startNodeUid);
  Preconditions.checkExists(endNodeUid);
  Preconditions.checkExists(direction);
  Preconditions.checkExists(mode);

  Preconditions.checkArgument(/^[0-9a-f]{1,16}$/i.test(startNodeUid));
  Preconditions.checkArgument(/^[0-9a-f]{1,16}$/i.test(endNodeUid));
  Preconditions.checkArgument(
    direction === 'forward' || direction === 'backward',
  );
  Preconditions.checkArgument(routingModes.has(mode as Mode));
  return key as RouteKey;
}

export function createRouteKey(
  startNodeUid: bigint,
  endNodeUid: bigint,
  direction: Direction,
  mode: Mode,
): RouteKey {
  return `${startNodeUid.toString(16)}-${endNodeUid.toString(16)}-${direction}-${mode}`;
}

export function findRouteFromKey(key: RouteKey, context: Context): Route {
  assertRouteKey(key);
  const [startNodeUid, endNodeUid, direction, mode] = key.split('-');
  console.log('finding route from key', key, {
    startNodeUid,
    endNodeUid,
    direction,
    mode,
  });

  return findRoute(
    BigInt('0x' + startNodeUid),
    BigInt('0x' + endNodeUid),
    direction as Direction,
    mode as Mode,
    context,
  );
}

export function findRoute(
  startNodeUid: bigint,
  endNodeUid: bigint,
  direction: Direction,
  mode: Mode,
  context: Context,
): Route {
  Preconditions.checkArgument(
    context.graph.has(startNodeUid),
    `cannot find route from unknown node ${startNodeUid.toString(16)}`,
  );
  Preconditions.checkArgument(
    context.graph.has(endNodeUid),
    `cannot find route to unknown node ${endNodeUid.toString(16)}`,
  );
  const key = createRouteKey(startNodeUid, endNodeUid, direction, mode);
  // console.log('finding route', startNodeUid, 'direction', endNodeUid);
  const { nodeLUT, graph } = context;

  const start = assertExists(nodeLUT.get(startNodeUid));
  const goal = assertExists(nodeLUT.get(endNodeUid));

  const openSet = new Queue<Neighbor>({
    comparator: (a, b) => {
      const fa = fScore.get(a) ?? Infinity;
      const fb = fScore.get(b) ?? Infinity;
      // sort smallest values first
      return fb - fa;
    },
  });
  const startAsNeighbor: Neighbor = {
    nodeUid: startNodeUid,
    distance: 0,
    duration: 0,
    direction,
    dlcGuard: -1, // this value shouldn't be read.
  };
  openSet.push(startAsNeighbor);
  const cameFrom = new Map<Neighbor, Neighbor>();

  // the score of the cheapest known path from start to `Neighbor`
  const gScore = new Map<Neighbor, number>();
  gScore.set(startAsNeighbor, 0);

  const h = (n: PartialNode) => (mode === 'fastest' ? 0 : distance(n, goal));
  const d = (_from: Neighbor, to: Neighbor) => {
    switch (mode) {
      case 'shortest':
        return to.distance;
      case 'smallRoads':
        return to.isOneLaneRoad ? to.distance : to.distance * 10;
      case 'fastest':
        return to.duration;
      default:
        throw new UnreachableError(mode);
    }
  };
  // the current best guess as to how cheap a path could be from start to finish
  // if it goes through `Neighbor`.
  const fScore = new Map<Neighbor, number>();
  fScore.set(startAsNeighbor, h(start));

  let numIters = 0;
  while (openSet.length) {
    numIters++;
    const current = openSet.pop();
    if (current.nodeUid === endNodeUid) {
      return {
        success: true,
        key,
        mode,
        score: assertExists(gScore.get(current)),
        ...reconstructPath(cameFrom, current),
      };
    }

    const neighbors = graph.get(current.nodeUid);
    if (!neighbors) {
      // this situation should be ok; happens with hidden roads/prefabs.
      //console.log(
      //  'warning: graph does not contain entry for node with uid',
      //  current.nodeId,
      //  numIters,
      //);
      continue;
    }

    const neighborsInDirection =
      current.direction === 'forward' ? neighbors.forward : neighbors.backward;
    for (const neighbor of neighborsInDirection) {
      if (!context.enabledDlcGuards.has(neighbor.dlcGuard)) {
        continue;
      }
      const tentativeScore =
        (gScore.get(current) ?? Infinity) + d(current, neighbor);
      if (tentativeScore < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeScore);
        fScore.set(
          neighbor,
          tentativeScore + h(assertExists(nodeLUT.get(neighbor.nodeUid))),
        );
        if (!openSet.has(neighbor)) {
          openSet.push(neighbor);
        }
      }
    }
  }
  return {
    success: false,
    key,
    mode,
    numIters,
  };
}

function reconstructPath(
  cameFrom: Map<Neighbor, Neighbor>,
  current: Neighbor,
): { route: Neighbor[]; distance: number; duration: number } {
  let distance = 0;
  let duration = 0;
  const path: Neighbor[] = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
    distance += current.distance;
    duration += current.duration;
  }
  if (path.length === 1) {
    path.push(path[0]);
  }

  return { route: path, distance, duration };
}

/** TinyQueue, but with a `.has(value)` method. */
class Queue<T> extends TinyQueue<T> {
  private readonly items = new Set<T>();

  constructor(options: { comparator: (a: T, b: T) => number }) {
    super([], options.comparator);
  }

  has(value: T) {
    return this.items.has(value);
  }

  override push(value: T) {
    Preconditions.checkState(!this.items.has(value));
    super.push(value);
    this.items.add(value);
  }

  override pop(): T {
    Preconditions.checkState(this.length > 0);
    const top = super.pop()!;
    Preconditions.checkState(this.items.has(top));
    this.items.delete(top);
    return top;
  }
}
