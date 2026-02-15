import { assert, assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import { Preconditions } from '@truckermudgeon/base/precon';
import type {
  MapDataKeys,
  MappedDataForKeys,
} from '@truckermudgeon/generator/mapped-data';
import { ItemType } from '@truckermudgeon/map/constants';
import { fromAtsCoordsToWgs84 } from '@truckermudgeon/map/projections';
import type {
  CompanyItem,
  FerryItem,
  Node,
  Prefab,
  Road,
  RoadLook,
} from '@truckermudgeon/map/types';
import { lineString } from '@turf/helpers';
import { EventEmitter } from 'events';
import type { Route, RouteIndex, TruckSimTelemetry } from '../../types';
import type { DomainEventSink } from '../events';
import type { GraphAndMapData } from '../lookup-data';
import type { TelemetryEventEmitter } from '../session-actor';
import type { RouteWithLookup, RoutingService } from './generate-routes';
import { reroute } from './generate-routes';
import { getCommonItem } from './guidance';
import { scoreLine } from './score-line';

export type RouteEventEmitter = EventEmitter<{
  /**
   * Emitted when:
   * - a route is set or unset
   * - a route changes in response to:
   *   - a truck veering off course from the current route
   *   - a waypoint has been added to the current route
   *   - waypoints have been re-ordered within the current route
   */
  update: [Route | undefined];
  /**
   * Emitted as a truck makes progress along the current route, specifically,
   * when a truck enters a route road/prefab.
   *
   * Emits undefined when no route exists.
   * TODO re-examine need for `undefined` progress.
   */
  progress: [RouteIndex | undefined];
  /**
   * Emitted when truck reaches the last node of a route segment. The number
   * in the event corresponds to the index of the segment whose end was reached.
   */
  segmentComplete: [number];
}>;

export const detectRouteMapDataKeys = [
  'nodes',
  'roads',
  'roadLooks',
  'prefabs',
  'companies',
  'companyDefs',
  'ferries',
  'prefabDescriptions', // for route generation
] satisfies MapDataKeys;

type DetectRouteMappedData = MappedDataForKeys<typeof detectRouteMapDataKeys>;

const dummyItemSymbol = Symbol('dummy item');

export function detectRouteEvents(opts: {
  telemetryEventEmitter: TelemetryEventEmitter;
  graphAndMapData: GraphAndMapData<DetectRouteMappedData>;
  routing: RoutingService;
  domainEventSink: DomainEventSink;
}): {
  setActiveRoute: (route: RouteWithLookup | undefined) => void;
  readActiveRoute: () => RouteWithLookup | undefined;
  readRouteIndex: () => RouteIndex | undefined;
  routeEventEmitter: RouteEventEmitter;
  unpauseRouteEvents: () => void;
} {
  const { telemetryEventEmitter, graphAndMapData, routing, domainEventSink } =
    opts;
  const routeEventEmitter: RouteEventEmitter = new EventEmitter();

  const readRouteIndex = () => routeIndex;
  const setRouteIndex = (newRouteIndex: RouteIndex | undefined) => {
    routeIndex = newRouteIndex;
    console.log('progress', routeIndex);
    routeEventEmitter.emit('progress', routeIndex);
  };
  const segmentComplete = (segmentIndex: number) => {
    console.log('segment', segmentIndex, 'complete');
    routeEventsPaused.paused = true;
    routeEventEmitter.emit('segmentComplete', segmentIndex);
  };

  const unpauseRouteEvents = () => {
    routeEventsPaused.paused = false;
  };
  const readActiveRoute = () => activeRoute;
  const setActiveRoute = (route: RouteWithLookup | undefined) => {
    routeEventsPaused.paused = false;
    activeRoute = route;
    routeEventEmitter.emit('update', stripLookup(route));
    setRouteIndex(
      route ? { segmentIndex: 0, stepIndex: 0, nodeIndex: 0 } : undefined,
    );

    if (detectRouteEvents) {
      detectRouteEvents.signal.cancelled = true;
      telemetryEventEmitter.off('telemetry', detectRouteEvents.handler);
    }

    if (activeRoute) {
      detectRouteEvents = createUpdateListener(
        activeRoute,
        setActiveRoute,
        setRouteIndex,
        segmentComplete,
        routeEventsPaused,
        graphAndMapData,
        routing,
        domainEventSink,
      );
      telemetryEventEmitter.on('telemetry', detectRouteEvents.handler);
    }
  };

  const routeEventsPaused = { paused: false };
  let activeRoute: RouteWithLookup | undefined;
  let routeIndex: RouteIndex | undefined;
  let detectRouteEvents:
    | {
        handler: (t: TruckSimTelemetry) => void;
        signal: { cancelled: boolean };
      }
    | undefined;

  return {
    setActiveRoute,
    readActiveRoute,
    readRouteIndex,
    routeEventEmitter,
    unpauseRouteEvents,
  };
}

const toString = (item: Prefab | Road | symbol): string => {
  if (typeof item === 'symbol') {
    return 'dummy item';
  }
  return item.type === ItemType.Prefab
    ? item.token
    : 'road ' + item.uid.toString(16).slice(-4);
};

interface IsTruckOnRouteContext {
  nodes: ReadonlyMap<bigint, Node>;
  tsMapData: GraphAndMapData<DetectRouteMappedData>['tsMapData'];
  roadAndPrefabRTree: GraphAndMapData['roadAndPrefabRTree'];
  // mutated by `isTruckOnRoute`
  expectedItems: (Prefab | Road | symbol)[];
}

function isTruckOnRoute(
  truck: TruckSimTelemetry['truck'],
  activeRoute: RouteWithLookup,
  context: IsTruckOnRouteContext,
): boolean {
  const { roadAndPrefabRTree, nodes, expectedItems } = context;
  const location = calculateLocation(
    truck,
    nodes,
    context.tsMapData.roadLooks,
    roadAndPrefabRTree,
  );
  if (!location) {
    // benefit of the doubt: we're near a node that isn't part of the route,
    // but we don't know where we are.
    return true;
  }

  if (typeof expectedItems[0] === 'symbol') {
    // skip over dummy expected items, because they only exist when neighbor
    // nodes repeat, or we're at a ferry terminal.
    expectedItems.shift();
    return true;
  }

  const expectedItem = expectedItems[0];
  const nextItem = expectedItems[1];
  const nextNextItem = expectedItems[2];
  // TODO what if expectedItem is in another segment?
  if (location === expectedItem) {
    console.log('location is expected');
    return true;
  } else if (location === nextItem) {
    console.log('advance!');
    expectedItems.shift();
    return true;
  } else if (location === nextNextItem) {
    // there are some routes that contain very short road segments or prefabs.
    // lookahead _one more item_ to account for these.
    console.log('advance advance!');
    expectedItems.shift();
    expectedItems.shift();
    return true;
  }

  // HACK special-case: look to see if we've just rerouted.
  // rerouting can produce routes starting at the road/prefab _following_ the
  // truck's current location. if the truck is stationary in this case, then we
  // end up in a loop where we're always recalculating the same route, over and
  // over again.
  if (activeRoute.lookup.nodeUidsFlat.length === expectedItems.length + 1) {
    const firstNodeUid = activeRoute.lookup.nodeUidsFlat[0];
    if (location.type === ItemType.Road) {
      if (
        firstNodeUid === location.startNodeUid ||
        firstNodeUid === location.endNodeUid
      ) {
        return true;
      }
    } else if (location.type === ItemType.Prefab) {
      if (location.nodeUids.includes(firstNodeUid)) {
        return true;
      }
    }
  }

  console.log(
    'VEER: location is within wrong item.',
    'expected',
    toString(expectedItem),
    'got',
    toString(location),
    'at',
    fromAtsCoordsToWgs84([truck.position.X, truck.position.Z]),
    [truck.position.X, truck.position.Z],
  );
  return false;
}

function createUpdateListener(
  activeRoute: RouteWithLookup,
  setActiveRoute: (route: RouteWithLookup | undefined) => void,
  setRouteIndex: (routeIndex: RouteIndex | undefined) => void,
  segmentComplete: (segmentIndex: number) => void,
  routeEventsPaused: Readonly<{ paused: boolean }>,
  graphAndMapData: GraphAndMapData<DetectRouteMappedData>,
  routing: RoutingService,
  domainEventSink: DomainEventSink,
): {
  handler: (telemetry: TruckSimTelemetry) => void;
  signal: { cancelled: boolean };
} {
  const expectedItems: (Prefab | Road | symbol)[] = [];
  let prevNodeUid = activeRoute.lookup.nodeUidsFlat[0];

  // TODO precalc this lookup. And consider merging Ferry & FerryItem types.
  const ferriesByUid = new Map<bigint, FerryItem>(
    graphAndMapData.tsMapData.ferries
      .values()
      .map(f => [f.uid, { ...f, type: ItemType.Ferry }]),
  );
  // TODO precalc this lookup
  const companiesByPrefab = new Map<bigint, CompanyItem>(
    graphAndMapData.tsMapData.companies.values().map(c => [c.prefabUid, c]),
  );
  const lookups = {
    ferriesByUid,
    companiesByPrefab,
  };

  const start = Date.now();
  for (const curNodeUid of activeRoute.lookup.nodeUidsFlat.slice(1)) {
    if (prevNodeUid === curNodeUid) {
      // dummy item for repeated nodes, e.g., for an arrival step.
      expectedItems.push(dummyItemSymbol);
      continue;
    }
    let common = getCommonItem(
      prevNodeUid,
      curNodeUid,
      graphAndMapData.tsMapData,
      lookups,
    );
    if (common.type === ItemType.Company) {
      common = assertExists(
        graphAndMapData.tsMapData.prefabs.get(common.prefabUid),
      );
    } else if (common.type === ItemType.Ferry) {
      expectedItems.push(dummyItemSymbol);
      prevNodeUid = curNodeUid;
      continue;
    }
    expectedItems.push(common);
    prevNodeUid = curNodeUid;
  }
  console.log(
    'creating update listener:',
    expectedItems.length,
    'items in route with',
    activeRoute.lookup.nodeUidsFlat.length,
    'flattened node uids',
    `${Date.now() - start} ms`,
  );

  const detectionContext: IsTruckOnRouteContext = {
    nodes: graphAndMapData.tsMapData.nodes,
    tsMapData: graphAndMapData.tsMapData,
    roadAndPrefabRTree: graphAndMapData.roadAndPrefabRTree,
    expectedItems,
  };

  let isReRouting = false;
  let curSegmentIndex = 0;

  const signal = { cancelled: false };
  const handler = (telemetry: TruckSimTelemetry): void => {
    if (signal.cancelled) {
      console.log('ignore reroute; received cancelled signal');
      return;
    }
    if (telemetry.game.paused) {
      return;
    }
    if (routeEventsPaused.paused) {
      return;
    }
    if (isReRouting) {
      return;
    }

    const curRouteStepIndex =
      activeRoute.lookup.nodeUidsFlat.length - 1 - expectedItems.length;
    if (isTruckOnRoute(telemetry.truck, activeRoute, detectionContext)) {
      const newRouteStepIndex =
        activeRoute.lookup.nodeUidsFlat.length - 1 - expectedItems.length;
      if (curRouteStepIndex !== newRouteStepIndex) {
        const routeIndex = arrayIndexToRouteIndex(
          newRouteStepIndex,
          activeRoute,
          curSegmentIndex,
        );
        setRouteIndex(routeIndex);
        return;
      }

      // truck is still on current step of route. check to see if it's
      // reached the end of a step that's also the end of the segment.
      const routeIndex = arrayIndexToRouteIndex(
        curRouteStepIndex,
        activeRoute,
        curSegmentIndex,
      );
      const curSegment = assertExists(
        activeRoute.segments[routeIndex.segmentIndex],
      );
      if (curSegment !== activeRoute.segments.at(-1)) {
        // not at the last segment.
        //return;
      }

      console.log('routeIndex is', routeIndex);
      const curStep = assertExists(curSegment.steps[routeIndex.stepIndex]);
      // special case: degenerate routes
      if (
        curSegment.steps.length === 1 &&
        curStep === curSegment.steps.at(-1)
      ) {
        // do nothing.
      } else {
        // add additional because of arrival step.
        if (curStep !== curSegment.steps.at(-2)) {
          // not at the penultimate step.
          return;
        }
        if (routeIndex.nodeIndex <= curStep.nodesTraveled - 3) {
          //console.log('too far to measure dist from step end');
          //return;
        }
      }

      const stepEndNode = assertExists(
        detectionContext.tsMapData.nodes.get(
          activeRoute.lookup.nodeUids[routeIndex.segmentIndex].at(-1)!,
        ),
      );
      const distToStepEnd = distance(
        [telemetry.truck.position.X, telemetry.truck.position.Z],
        stepEndNode,
      );
      console.log('distance to stepEndNode', distToStepEnd);
      if (distToStepEnd <= 15) {
        console.log(
          'reached end! suppressing route events',
          routeIndex,
          curRouteStepIndex,
        );

        // ensure routeIndex gets triggered for reaching end.
        expectedItems.shift();
        const newRouteStepIndex =
          activeRoute.lookup.nodeUidsFlat.length - 1 - expectedItems.length;
        const newRouteIndex = arrayIndexToRouteIndex(
          newRouteStepIndex,
          activeRoute,
          curSegmentIndex,
        );
        setRouteIndex(newRouteIndex);

        segmentComplete(routeIndex.segmentIndex);
        curSegmentIndex = routeIndex.segmentIndex + 1;
      }
    } else {
      // TODO move the rest of this code in an "onVeer" handler.

      // truck has veered off the active route. re-route.
      assert(
        activeRoute.lookup.nodeUidsFlat.length > 0,
        'activeRoute cannot be empty',
      );
      const destNodeUid = activeRoute.lookup.nodeUidsFlat.at(-1)!;

      console.log(`rerouting to ${destNodeUid.toString(16)}`);
      isReRouting = true;
      const routePromise = reroute(activeRoute, {
        routeIndex: arrayIndexToRouteIndex(
          curRouteStepIndex,
          activeRoute,
          curSegmentIndex,
        ),
        graphAndMapData,
        routing,
        truck: telemetry.truck,
        domainEventSink,
      });
      routePromise
        .then(route => !signal.cancelled && setActiveRoute(route))
        .catch(err => console.error(err))
        .finally(() => (isReRouting = false));
    }
  };

  return {
    handler,
    signal,
  };
}

function getMinMaxZ(
  item: Road | Prefab,
  nodes: ReadonlyMap<bigint, Node>,
): [number, number] {
  const nodeUids =
    item.type === ItemType.Road
      ? [item.startNodeUid, item.endNodeUid]
      : item.nodeUids;
  const nodeZs = nodeUids.map(uid => assertExists(nodes.get(uid)).z);
  return [Math.min(...nodeZs), Math.max(...nodeZs)];
}

// TODO move this somewhere shared.
// TODO should this only return items in the graph?
export function calculateLocation(
  truck: Pick<TruckSimTelemetry['truck'], 'position' | 'orientation'>,
  nodes: ReadonlyMap<bigint, Node>,
  roadLooks: ReadonlyMap<string, RoadLook>,
  rtree: GraphAndMapData['roadAndPrefabRTree'],
): Road | Prefab | undefined {
  const truckPos = {
    x: truck.position.X,
    y: truck.position.Z,
    z: truck.position.Y,
  };
  const padding = 1;
  const hits = rtree.search({
    minX: truckPos.x - padding,
    minY: truckPos.y - padding,
    maxX: truckPos.x + padding,
    maxY: truckPos.y + padding,
  });
  if (hits.length === 0) {
    console.log('unknown location');
    return;
  }
  const valid = hits
    .filter(h => {
      // filter out items that are too low or too high in altitude
      const [minZ, maxZ] = getMinMaxZ(h.item, nodes);
      return minZ - 2 <= truckPos.z && truckPos.z <= maxZ + 4;
    })
    .map(entry => ({
      topScore: Math.max(
        ...entry.lines
          .map(coords => lineString(coords).geometry)
          .map(ls => {
            if (entry.item.type === ItemType.Road) {
              const roadLook = assertExists(
                roadLooks.get(entry.item.roadLookToken),
              );
              // The following Math.abs call is only valid if the road has
              // just one linestring entry. This may change if two-way roads
              // have two linestring entries.
              assert(entry.lines.length === 1);
              if (roadLook.lanesLeft.length && roadLook.lanesRight.length) {
                return Math.abs(scoreLine(ls, truck));
              }
            }
            return scoreLine(ls, truck);
          }),
      ),
      item: entry.item,
    }));
  if (valid.length === 0) {
    console.log('no valid locations found');
    return;
  }

  const probable = valid.sort((a, b) => b.topScore - a.topScore)[0];
  return probable.item;
}

function stripLookup(route: RouteWithLookup | undefined): Route | undefined {
  if (route == null) {
    return undefined;
  }
  const { lookup, ...rest } = route;
  return { ...rest };
}

function arrayIndexToRouteIndex(
  arrayIndex: number,
  route: Route,
  curSegmentIndex: number,
): RouteIndex {
  Preconditions.checkArgument(arrayIndex >= 0);
  Preconditions.checkArgument(
    0 <= curSegmentIndex && curSegmentIndex < route.segments.length,
  );

  let nodeIndex = arrayIndex;
  for (
    let segmentIndex = 0;
    segmentIndex < route.segments.length;
    segmentIndex++
  ) {
    const segment = route.segments[segmentIndex];
    for (let stepIndex = 0; stepIndex < segment.steps.length; stepIndex++) {
      const step = segment.steps[stepIndex];
      // TODO what's a valid route? is a two-node route from one end of a road to
      //  another valid? what does that route look like in terms of steps, including
      //  depart/arrival steps?
      if (nodeIndex - step.nodesTraveled < 0) {
        return {
          segmentIndex,
          stepIndex,
          nodeIndex,
        };
      }
      nodeIndex -= step.nodesTraveled;

      if (
        nodeIndex === 0 &&
        step.nodesTraveled === 0 &&
        curSegmentIndex === segmentIndex
      ) {
        // edge case: arrival/departure steps
        return {
          segmentIndex,
          stepIndex:
            // skip departure step
            stepIndex === 0 && segment.steps.length > 1 ? 1 : stepIndex,
          nodeIndex,
        };
      }
    }
  }

  console.error(route);
  throw new Error(
    `arrayIndex ${arrayIndex} is invalid for route. leftover: ` + nodeIndex,
  );
}

export const forTesting = {
  arrayIndexToRouteIndex,
  createUpdateListener,
};
