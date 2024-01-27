import { assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type { Neighbor, Neighbors, Node } from '@truckermudgeon/map/types';
import type { PriorityQueueInstance } from 'priorityqueue';
import PriorityQueue from 'priorityqueue';
import type { PriorityQueueOption } from 'priorityqueue/lib/PriorityQueue';

export type Direction = 'forward' | 'backward';
export type Mode = 'shortest' | 'smallRoads';
export interface Route {
  route: Neighbor[];
  distance: number;
}

export type PartialNode = Pick<Node, 'x' | 'y'>;
export interface Context {
  nodeLUT: Map<string, PartialNode>;
  graph: Map<string, Neighbors>;
}

export function findRoute(
  startNodeUid: string,
  endNodeUid: string,
  direction: Direction,
  mode: Mode,
  context: Context,
) {
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
    nodeId: startNodeUid,
    distance: 0,
    direction,
  };
  openSet.push(startAsNeighbor);
  const cameFrom = new Map<Neighbor, Neighbor>();

  const gScore = new Map<Neighbor, number>();
  gScore.set(startAsNeighbor, 0);

  //const h = (_n: PartialNode) => 0;
  const h = (n: PartialNode) => distance(n, goal);
  const d = (_from: Neighbor, to: Neighbor) => {
    switch (mode) {
      case 'shortest':
        return to.distance;
      case 'smallRoads':
        return to.isOneLaneRoad ? to.distance : to.distance * 10;
      default:
        throw new UnreachableError(mode);
    }
  };
  const fScore = new Map<Neighbor, number>();
  fScore.set(startAsNeighbor, h(start));

  let numIters = 0;
  while (!openSet.isEmpty()) {
    numIters++;
    const current = openSet.pop();
    if (current.nodeId === endNodeUid) {
      return reconstructPath(cameFrom, current);
    }

    const neighbors = graph.get(current.nodeId);
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
      const tentativeScore =
        (gScore.get(current) ?? Infinity) + d(current, neighbor);
      if (tentativeScore < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeScore);
        fScore.set(
          neighbor,
          tentativeScore + h(assertExists(nodeLUT.get(neighbor.nodeId))),
        );
        if (!openSet.has(neighbor)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  console.warn(
    `no ${direction} route found from`,
    start,
    'and',
    goal,
    `(${numIters} iterations)`,
  );
  return undefined;
}

function reconstructPath(
  cameFrom: Map<Neighbor, Neighbor>,
  current: Neighbor,
): Route {
  let distance = 0;
  const path: Neighbor[] = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
    distance += current.distance;
  }
  if (path.length === 1) {
    path.push(path[0]);
  }

  return { route: path, distance };
}

/** PriorityQueue, but with a `.has(value)` method. */
class Queue<T> extends PriorityQueue<T> {
  private readonly items = new Set<T>();

  constructor(options: PriorityQueueOption<T>) {
    super(options);
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
    const top = super.pop();
    Preconditions.checkState(this.items.has(top));
    this.items.delete(top);
    return top;
  }

  override clear() {
    super.clear();
    this.items.clear();
  }

  override merge<Instance extends PriorityQueueInstance<T>>(other: Instance) {
    super.merge(other);
    for (const value of this.collection) {
      this.items.add(value);
    }
  }
}
