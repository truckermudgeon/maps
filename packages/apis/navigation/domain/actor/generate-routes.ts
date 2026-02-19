import polyline from '@mapbox/polyline';
import { rotateRight } from '@truckermudgeon/base/array';
import { assert, assertExists } from '@truckermudgeon/base/assert';
import {
  distance,
  dot,
  normalizeRadians,
  subtract,
} from '@truckermudgeon/base/geom';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type {
  MapDataKeys,
  MappedDataForKeys,
} from '@truckermudgeon/generator/mapped-data';
import { ItemType } from '@truckermudgeon/map/constants';
import { calculateLaneInfo, toMapPosition } from '@truckermudgeon/map/prefabs';
import {
  fromAtsCoordsToWgs84,
  fromEts2CoordsToWgs84,
} from '@truckermudgeon/map/projections';
import type {
  Direction,
  Mode,
  Route as RawRoute,
  RouteKey,
} from '@truckermudgeon/map/routing';
import { assertRouteKey, createRouteKey } from '@truckermudgeon/map/routing';
import type {
  Node,
  Prefab,
  PrefabDescription,
  Road,
} from '@truckermudgeon/map/types';
import { lineString } from '@turf/helpers';
import { BranchType } from '../../constants';
import type {
  Route,
  RouteIndex,
  RouteSegment,
  TruckSimTelemetry,
} from '../../types';
import type { DomainEventSink } from '../events';
import type { GraphAndMapData, GraphMappedData } from '../lookup-data';
import { calculateLocation } from './detect-route-events';
import { calculateSteps } from './guidance';
import { scoreLine } from './score-line';

export interface RoutingService {
  findRouteFromKey(key: RouteKey): Promise<RawRoute>;
}

export type RouteWithLookup = Route & {
  lookup: {
    nodeUids: readonly bigint[][];
    nodeUidsFlat: readonly bigint[];
    nodeUidsSet: ReadonlySet<bigint>;
  };
};

export const generateRoutesMapDataKeys = [
  'nodes',
  'roads',
  'roadLooks',
  'prefabs',
  'prefabDescriptions',
  'companies',
  'companyDefs',
  'ferries',
] satisfies MapDataKeys;

type RouteMappedData = MappedDataForKeys<typeof generateRoutesMapDataKeys>;

// TODO add current truck pos as an argument, so that route generated is
//  complete?
export async function generateRouteFromKeys(
  segmentKeys: string[],
  context: {
    graphAndMapData: GraphAndMapData<RouteMappedData>;
    routing: RoutingService;
  },
): Promise<RouteWithLookup> {
  const {
    graphAndMapData: {
      graphData,
      graphData: { graph },
      tsMapData,
      signRTree,
    },
    routing,
  } = context;
  const routesWithoutLookup = await Promise.all(
    segmentKeys.map(async key => {
      // TODO how is navigator producing node uids that aren't in the graph?
      // the need for massaging node uids is questionable.
      let routeKey = assertRouteKey(key);
      const [startNodeUidString, endNodeUidString, direction, mode] =
        routeKey.split('-') as [string, string, Direction, Mode];
      let startNodeUid = BigInt(`0x${startNodeUidString}`);
      let endNodeUid = BigInt(`0x${endNodeUidString}`);
      if (!graph.has(startNodeUid)) {
        const startNode = assertExists(tsMapData.nodes.get(startNodeUid));
        const closestStart = context.graphAndMapData.graphNodeRTree.findClosest(
          startNode.x,
          startNode.y,
        ).node;
        startNodeUid = closestStart.uid;
        console.log(
          'massaging start node',
          startNodeUidString,
          startNodeUid.toString(16),
        );
      }
      if (!graph.has(startNodeUid)) {
        const startNode = assertExists(tsMapData.nodes.get(startNodeUid));
        const closestStart = context.graphAndMapData.graphNodeRTree.findClosest(
          startNode.x,
          startNode.y,
        ).node;
        startNodeUid = closestStart.uid;
      }
      if (!graph.has(endNodeUid)) {
        const endNode = assertExists(tsMapData.nodes.get(endNodeUid));
        const closestEnd = context.graphAndMapData.graphNodeRTree.findClosest(
          endNode.x,
          endNode.y,
        ).node;
        endNodeUid = closestEnd.uid;
        console.log(
          'massaging end node',
          endNodeUidString,
          endNodeUid.toString(16),
        );
      }
      routeKey = createRouteKey(startNodeUid, endNodeUid, direction, mode);

      const route = await routing.findRouteFromKey(routeKey);
      if (!route.success) {
        console.warn(`could not find route for key "${key}"; ignoring.`);
        return;
      }
      return route;
    }),
  );

  const routes = routesWithoutLookup
    .filter(route => route != null)
    .map(route => toRouteWithLookup(route, tsMapData, signRTree, graphData));
  return combineRoutes(routes);
}

export async function addWaypoint(
  toNodeUid: bigint,
  activeRoute: RouteWithLookup,
  /**
   * The segment that the way point should be added in the middle of.
   * - auto: automatically choose the best segment
   * - last: add the waypoint _in the middle of the last segment_. does NOT
   *   append the waypoint to the end of the route.
   */
  whichSegment: 'auto' | 'last',
  context: {
    graphAndMapData: GraphAndMapData<GraphMappedData>;
    routeIndex: RouteIndex;
    truck: TruckSimTelemetry['truck'];
    domainEventSink: DomainEventSink;
    routing: RoutingService;
  },
): Promise<RouteWithLookup> {
  const graphData = context.graphAndMapData.graphData;
  const strategy = activeRoute.segments[0].strategy;
  const routeSegments = await toRerouteSegments(activeRoute, context);

  let bestSegments = routeSegments.slice(0);
  let bestScore = Infinity;
  for (let i = 0; i < routeSegments.length; i++) {
    switch (whichSegment) {
      case 'auto':
        // do nothing; this `for` loop already implements "auto" behavior.
        break;
      case 'last':
        if (i !== routeSegments.length - 1) {
          // we're not processing the last segment, so skip this `for` loop
          // iteration.
          continue;
        }
        break;
      default:
        throw new UnreachableError(whichSegment);
    }

    const segment = routeSegments[i];
    const start = segment.lookup.nodeUidsFlat[0];
    const startNext = segment.lookup.nodeUidsFlat[1];
    const end = assertExists(segment.lookup.nodeUidsFlat.at(-1));

    let graphNode = assertExists(graphData.graph.get(start));
    // TODO is this a safe assumption to make (that routing to the new
    //  intermediary point is done in the existing direction)?
    let firstDirection: Direction = graphNode.forward.find(
      n => n.nodeUid === startNext,
    )
      ? 'forward'
      : 'backward';
    // TODO looks like service areas in graph are off; there are some service
    //  areas that an only be entered, but never exited.
    if (
      graphData.serviceAreas.has(start) &&
      assertExists(graphData.graph.get(start))[firstDirection].length === 0
    ) {
      console.log('start service area hack', start.toString(16));
      firstDirection = firstDirection === 'forward' ? 'backward' : 'forward';
    }

    const first = await generateRouteFromKeys(
      [createRouteKey(start, toNodeUid, firstDirection, strategy)],
      context,
    );

    const firstPenultimate = assertExists(first.lookup.nodeUidsFlat.at(-2));
    graphNode = assertExists(graphData.graph.get(firstPenultimate));
    let firstPenultimateDirection: Direction = graphNode.forward.find(
      n => n.nodeUid === toNodeUid,
    )
      ? 'forward'
      : 'backward';
    if (
      graphData.serviceAreas.has(toNodeUid) &&
      assertExists(graphData.graph.get(toNodeUid))[firstPenultimateDirection]
        .length === 0
    ) {
      console.log('end service area hack', toNodeUid.toString(16));
      firstPenultimateDirection =
        firstPenultimateDirection === 'forward' ? 'backward' : 'forward';
    }

    const second = await generateRouteFromKeys(
      [createRouteKey(toNodeUid, end, firstPenultimateDirection, strategy)],
      context,
    );

    // Calculate added cost of inserting newPoint between `start` and `end`
    const added =
      first.segments[0].score +
      second.segments[0].score -
      segment.segments[0].score;

    if (added < bestScore) {
      bestScore = added;
      bestSegments = [
        ...routeSegments.slice(0, i),
        first,
        second,
        ...routeSegments.slice(i + 1),
      ];
    }
  }

  const waypointNode = assertExists(
    context.graphAndMapData.tsMapData.nodes.get(toNodeUid),
  );
  const waypointLngLat = fromAtsCoordsToWgs84([waypointNode.x, waypointNode.y]);

  const withWaypoint = combineRoutes(bestSegments);
  withWaypoint.detour = {
    distanceMeters: Math.max(
      0,
      withWaypoint.distanceMeters - activeRoute.distanceMeters,
    ),
    duration: Math.max(0, withWaypoint.duration - activeRoute.duration),
    lngLat: waypointLngLat,
  };
  return withWaypoint;
}

export async function reroute(
  activeRoute: RouteWithLookup,
  context: {
    graphAndMapData: GraphAndMapData<RouteMappedData>;
    routing: RoutingService;
    routeIndex: RouteIndex;
    truck: TruckSimTelemetry['truck'];
    domainEventSink: DomainEventSink;
  },
): Promise<RouteWithLookup> {
  return combineRoutes(await toRerouteSegments(activeRoute, context));
}

async function toRerouteSegments(
  activeRoute: RouteWithLookup,
  context: {
    graphAndMapData: GraphAndMapData<RouteMappedData>;
    routing: RoutingService;
    routeIndex: RouteIndex;
    truck: TruckSimTelemetry['truck'];
    domainEventSink: DomainEventSink;
  },
): Promise<RouteWithLookup[]> {
  const { routeIndex } = context;
  const strategy = activeRoute.segments[0].strategy;
  const nextWaypointNodeUid = assertExists(
    activeRoute.lookup.nodeUids[routeIndex.segmentIndex].at(-1),
  );

  const { position, orientation } = context.truck;
  const miniTruck = { position, orientation };

  return [
    // A -> B
    assertExists(
      (await generateRoutes(nextWaypointNodeUid, [strategy], context))[0],
      `could not generate route to first waypoint ${nextWaypointNodeUid.toString(16)}, truck ${JSON.stringify(miniTruck)}`,
    ),
    // B -> C
    // C -> D
    // etc.
    ...sliceAndSpreadRoute(activeRoute, routeIndex.segmentIndex + 1),
  ];
}

let lastPrefabUidReported: bigint | undefined;

export async function generateRoutes(
  toNodeUid: bigint,
  modes: Mode[],
  context: {
    graphAndMapData: GraphAndMapData<RouteMappedData>;
    routing: RoutingService;
    truck: TruckSimTelemetry['truck'];
    domainEventSink: DomainEventSink;
  },
): Promise<RouteWithLookup[]> {
  Preconditions.checkArgument(modes.length > 0, 'modes cannot be empty');
  const { graphAndMapData, routing, truck, domainEventSink } = context;
  const { roadRTree, signRTree, graphData, tsMapData } = graphAndMapData;
  const truckPos: [number, number] = [truck.position.X, truck.position.Z];

  const location = calculateLocation(
    truck,
    tsMapData.nodes,
    tsMapData.roadLooks,
    graphAndMapData.roadAndPrefabRTree,
  );

  // TODO what if truck is in a ferry prefab? fromNodeUid should be ferry
  //  entrance or exit, depending on truck orientation. it should be `forward`
  //  if truck is pointing to ferry icon; 'backward' otherwise.

  const isCompanyPrefab = (prefab: Prefab) => {
    return (
      tsMapData.companies.values().find(c => c.prefabUid === prefab.uid) != null
    );
  };

  let allowRetryInOppositeDirection = false;
  let fromNodeUid: bigint;
  let direction: Direction;
  if (
    location == null ||
    location.type === ItemType.Road ||
    isCompanyPrefab(location)
  ) {
    const nearestRoad =
      location?.type === ItemType.Road
        ? // truck is on a road
          location
        : // truck is in a company prefab or unknown location.
          // fallback to nearest road.
          // TODO should fallback to closest road OR prefab?
          roadRTree.findClosest(truck.position.X, truck.position.Z).road;
    direction = getDirectionOnRoad(truck, nearestRoad, tsMapData.nodes);
    fromNodeUid = [nearestRoad.startNodeUid, nearestRoad.endNodeUid]
      .map(uid => assertExists(tsMapData.nodes.get(uid)))
      .sort((a, b) => distance(truckPos, a) - distance(truckPos, b))[0].uid;
  } else {
    // truck is in a prefab (that may or may not have nav curves)
    // guess the node the truck entered this prefab through by finding the node
    // that is probably the node the truck entered through.
    ({ fromNodeUid, direction } = getDirectionOnPrefab(
      truck,
      location,
      assertExists(tsMapData.prefabDescriptions.get(location.token)),
      tsMapData.nodes,
      domainEventSink,
    ));
    console.log({
      fromNodeUid,
      direction,
    });

    if (!graphData.graph.has(fromNodeUid)) {
      allowRetryInOppositeDirection = true;
      // recalculate location, from closest graph node
      const fromNode = assertExists(tsMapData.nodes.get(fromNodeUid));
      const closestGraphNode = graphAndMapData.graphNodeRTree.findClosest(
        fromNode.x,
        fromNode.y,
      );
      fromNodeUid = closestGraphNode.node.uid;
      const fakeTruck = {
        ...truck,
        position: {
          X: closestGraphNode.x,
          Y: closestGraphNode.z,
          Z: closestGraphNode.y,
        },
      };
      const location = calculateLocation(
        fakeTruck,
        tsMapData.nodes,
        tsMapData.roadLooks,
        graphAndMapData.roadAndPrefabRTree,
      );
      if (!location) {
        if (fromNodeUid !== lastPrefabUidReported) {
          domainEventSink?.publish({
            type: 'assertionFailed',
            where: 'generateRoutes: no location after prefab retry',
            data: {
              truckGamePos: [
                truck.position.X,
                truck.position.Y,
                truck.position.Z,
              ],
              truckHeading: truck.orientation.heading,
              fromNodeUid: fromNodeUid.toString(16),
            },
          });
          lastPrefabUidReported = fromNodeUid;
        }
        direction = 'forward';
      } else if (location.type === ItemType.Road) {
        direction = getDirectionOnRoad(fakeTruck, location, tsMapData.nodes);
      } else {
        direction = getDirectionOnPrefab(
          fakeTruck,
          location,
          assertExists(tsMapData.prefabDescriptions.get(location.token)),
          tsMapData.nodes,
          domainEventSink,
        ).direction;
      }
    }
  }

  // TODO refactor with detect-route-events

  const routes: RouteWithLookup[] = (
    await Promise.all(
      modes.map(async mode => {
        const start = Date.now();
        let route = await routing.findRouteFromKey(
          createRouteKey(fromNodeUid, toNodeUid, direction, mode),
        );
        if (!route.success) {
          // TODO probably should try other direction, in certain cases
          // (e.g., when accepting a new job and facing into a depot?)
          console.log('failed with iters', route.numIters);
          if (allowRetryInOppositeDirection || route.numIters === 1) {
            domainEventSink.publish({
              type: 'info',
              where: 'generateRoutes: retry in other direction',
              data: {
                fromNodeUid: fromNodeUid.toString(16),
                toNodeUid: toNodeUid.toString(16),
                originalDirection: direction,
                mode,
              },
            });
            route = await routing.findRouteFromKey(
              createRouteKey(
                fromNodeUid,
                toNodeUid,
                direction === 'forward' ? 'backward' : 'forward',
                mode,
              ),
            );
            if (route.success) {
              return toRouteWithLookup(route, tsMapData, signRTree, graphData);
            } else {
              console.log('retry failed');
            }
          }
          console.log('find route duration', Date.now() - start, 'ms');
          return undefined;
        }
        // TODO add depart step, depending on distance from truck to route starting points?
        console.log('find route duration', Date.now() - start, 'ms');
        return toRouteWithLookup(route, tsMapData, signRTree, graphData);
      }),
    )
  ).filter(route => route != null);

  if (routes.length === 0) {
    const { position, orientation } = truck;
    console.error('0 routes generated', {
      fromNodeUid: fromNodeUid.toString(16),
      toNodeUid: toNodeUid.toString(16),
      direction,
      location,
      truck: { position, orientation },
    });
  }
  return routes;
}

function toRouteWithLookup(
  route: RawRoute & { success: true },
  tsMapData: RouteMappedData,
  signRTree: GraphAndMapData['signRTree'],
  graphData: GraphAndMapData['graphData'],
): RouteWithLookup {
  const steps = calculateSteps(route.route, tsMapData, signRTree);
  const lastNodeUid = route.route.at(-1)!.nodeUid;
  const { x, y } = assertExists(tsMapData.nodes.get(lastNodeUid));
  const lonLat =
    tsMapData.map === 'usa'
      ? fromAtsCoordsToWgs84([x, y])
      : fromEts2CoordsToWgs84([x, y]);

  // TODO move this data up somewhere. or make a RouteGenerator class.
  const companiesByNode = new Map(
    tsMapData.companies.values().map(c => [c.nodeUid, c]),
  );

  let destinationText: string;
  if (companiesByNode.has(lastNodeUid)) {
    const company = companiesByNode.get(lastNodeUid)!;
    const companyDef = assertExists(tsMapData.companyDefs.get(company.token));
    destinationText = companyDef.name;
  } else if (graphData.serviceAreas.has(lastNodeUid)) {
    const facility = graphData.serviceAreas.get(lastNodeUid)!;
    // TODO make it so that facility.description can never be empty string
    destinationText = facility.description || 'Service Area';
  } else {
    // TODO wire in search's cityRTree, so we can say a point is in a city
    //cityRTree: RBush<
    //  BBox & {
    //    cityName: string;
    //    stateCode: string;
    //  }
    //>;
    destinationText = 'Waypoint';
  }

  steps.push({
    distanceMeters: 0,
    duration: 0,
    geometry: polyline.encode([lonLat, lonLat]),
    maneuver: {
      direction: BranchType.ARRIVE,
      lonLat,
      banner: {
        text: destinationText,
      },
    },
    nodesTraveled: 0,
    trafficIcons: [],
  });

  const segment: RouteSegment = {
    key: route.key,
    strategy: route.mode,
    distanceMeters: route.distance,
    duration: route.duration,
    score: route.score,
    steps,
  };

  const nodeUids = route.route.map(neighbor => neighbor.nodeUid);
  return {
    id: route.key,
    segments: [segment],
    lookup: lookupFor([nodeUids]),
    distanceMeters: segment.distanceMeters,
    duration: segment.duration,
  };
}

/**
 * @deprecated use `scoreLine` instead
 */
function getDirectionOnRoad(
  truck: TruckSimTelemetry['truck'],
  // TODO this should either:
  //   - also accept a prefab, or
  //   - be replaced with a node uid (and then `nodes` arg is changed to `context`
  //     arg with nodes, roads and prefabs)
  road: Road,
  nodes: ReadonlyMap<bigint, Node>,
): 'forward' | 'backward' {
  const roadStartNode = assertExists(nodes.get(road.startNodeUid));
  const roadEndNode = assertExists(nodes.get(road.endNodeUid));

  // TODO generate a proper line string.
  const roadStartPoint = fromAtsCoordsToWgs84([
    roadStartNode.x,
    roadStartNode.y,
  ]);
  const roadEndPoint = fromAtsCoordsToWgs84([roadEndNode.x, roadEndNode.y]);

  const score = scoreLine(
    lineString([roadStartPoint, roadEndPoint]).geometry,
    truck,
  );
  return score >= 0 ? 'forward' : 'backward';
}

export function getDirectionOnPrefab(
  truck: TruckSimTelemetry['truck'],
  prefab: Prefab,
  prefabDesc: PrefabDescription,
  nodes: ReadonlyMap<bigint, Node>,
  domainEventSink?: DomainEventSink,
): { fromNodeUid: bigint; direction: Direction } {
  if (prefab.ferryLinkUid != null) {
    return getDirectionOnFerryPrefab(truck, prefab, nodes);
  }

  const targetNodeUids = rotateRight(prefab.nodeUids, prefab.originNodeIndex);
  const laneInfo = calculateLaneInfo(prefabDesc);
  const potentialInputIndices: {
    targetIndex: number;
    score: number;
  }[] = [];
  for (const [targetIndex, lanes] of laneInfo.entries()) {
    for (const lane of lanes) {
      for (const branch of lane.branches) {
        // TODO cache this somewhere.
        const branchCurvePoints = branch.curvePoints.map(cp =>
          toMapPosition(cp, prefab, prefabDesc, nodes),
        );
        const branchLineString = lineString(
          branchCurvePoints.map(fromAtsCoordsToWgs84),
        );
        potentialInputIndices.push({
          targetIndex,
          score: scoreLine(branchLineString.geometry, truck),
        });
      }
    }
  }

  // TODO handle this better. fromNode should be based on whether or not truck
  // is facing toward/away.
  if (potentialInputIndices.length === 0) {
    domainEventSink?.publish({
      type: 'assertionFailed',
      where: 'getDirectionOnPrefab',
      data: {
        truckGamePos: [truck.position.X, truck.position.Y, truck.position.Z],
        truckHeading: truck.orientation.heading,
        prefabUid: prefab.uid.toString(16),
        prefabToken: prefab.token,
      },
    });
    const truckPos = [truck.position.X, truck.position.Z];
    const fromNodes = targetNodeUids
      .map(uid => assertExists(nodes.get(uid)))
      .sort((a, b) => distance(a, truckPos) - distance(b, truckPos));
    const fromNode = fromNodes[0];

    return {
      fromNodeUid: fromNode.uid,
      direction:
        fromNode.forwardItemUid === prefab.uid ? 'forward' : 'backward',
    };
  }

  // highest score, first
  potentialInputIndices.sort((a, b) => b.score - a.score);
  const fromNodeUid = targetNodeUids[potentialInputIndices[0].targetIndex];
  const fromNode = assertExists(nodes.get(fromNodeUid));

  return {
    fromNodeUid,
    direction: fromNode.forwardItemUid === prefab.uid ? 'forward' : 'backward',
  };
}

/** returns position of point, relative to truck */
export function getRelativePositionOfPoint(
  truck: TruckSimTelemetry['truck'],
  node: { x: number; y: number },
): 'front' | 'behind' {
  let truckTheta = normalizeRadians(
    truck.orientation.heading * Math.PI * 2 + Math.PI / 2,
  );
  if (truckTheta < 0) {
    truckTheta = normalizeRadians(truckTheta + 2 * Math.PI);
  }
  const truckDirection = [Math.cos(truckTheta), Math.sin(truckTheta)];

  const truckToExitVector = subtract(node, [
    truck.position.X,
    truck.position.Z,
  ]);

  const dotProduct = dot(truckToExitVector, truckDirection);
  if (dotProduct < 0) {
    return 'behind';
  } else {
    return 'front';
  }
}

function getDirectionOnFerryPrefab(
  truck: TruckSimTelemetry['truck'],
  prefab: Prefab,
  nodes: ReadonlyMap<bigint, Node>,
): { fromNodeUid: bigint; direction: Direction } {
  const prefabNodes = prefab.nodeUids.map(nid => assertExists(nodes.get(nid)));
  const exitNode = assertExists(
    prefabNodes.find(
      n => n.forwardItemUid === prefab.uid && n.backwardItemUid === 0n,
    ),
  );

  // TODO more accurate to calculate based on likely path (e.g., straight line)
  //  from prefab entrance to exit.
  const position = getRelativePositionOfPoint(truck, exitNode);
  if (position === 'behind') {
    // exit is behind truck, so truck is headed toward entrance (away from ferry)
    return { direction: 'backward', fromNodeUid: exitNode.uid };
  } else {
    // exit is in front of truck, so truck is headed toward ferry
    // TODO fromNodeUid should be prefab's entrance node, but how best to
    //  determine that without additional graph info?
    return { direction: 'forward', fromNodeUid: exitNode.uid };
  }
}

function sliceAndSpreadRoute(
  route: RouteWithLookup,
  segmentIndex: number,
): RouteWithLookup[] {
  Preconditions.checkArgument(
    0 <= segmentIndex && segmentIndex <= route.segments.length,
  );
  return route.segments.slice(segmentIndex).map((segment, index) => {
    const segmentAsRoute: Route = {
      distanceMeters: segment.distanceMeters,
      duration: segment.duration,
      id: Date.now().toString(16),
      segments: [segment],
    };
    return {
      ...segmentAsRoute,
      lookup: lookupFor([route.lookup.nodeUids[segmentIndex + index]]),
    };
  });
}

function combineRoutes(routes: RouteWithLookup[]): RouteWithLookup {
  Preconditions.checkArgument(routes.every(r => hasConsistentSegments(r)));
  const nodeUids = routes.flatMap(r => r.lookup.nodeUids);
  const segments = routes.flatMap(r => r.segments);
  const combined = {
    id: Date.now().toString(16),
    segments,
    lookup: lookupFor(nodeUids),
    distanceMeters: routes.reduce(
      (acc, route) => acc + route.distanceMeters,
      0,
    ),
    duration: routes.reduce((acc, route) => acc + route.duration, 0),
  };
  assert(hasConsistentSegments(combined), 'inconsistent segments');
  return combined;
}

function hasConsistentSegments(route: RouteWithLookup): boolean {
  return route.lookup.nodeUids.every((nodeUids, index) => {
    assert(nodeUids.length > 0, 'empty route lookup nodeUids array');
    if (index === 0) {
      return true;
    }
    const startNodeUid = nodeUids[0];
    const prevEndNodeUid = route.lookup.nodeUids[index - 1].at(-1)!;
    const consistent = startNodeUid === prevEndNodeUid;
    if (!consistent) {
      console.warn(
        'inconsistent segments',
        startNodeUid.toString(16),
        prevEndNodeUid.toString(16),
      );
    }
    return consistent;
  });
}

function lookupFor(nodeUids: bigint[][]): RouteWithLookup['lookup'] {
  Preconditions.checkArgument(nodeUids.length > 0);
  // TODO can assert arr.length > 1?
  Preconditions.checkArgument(nodeUids.every(arr => arr.length > 0));
  const flat = nodeUids.flat();
  return {
    nodeUids,
    nodeUidsFlat: flat,
    nodeUidsSet: new Set(flat),
  };
}

export const forTesting = {
  combineRoutes,
  sliceAndSpreadRoute,
  getDirectionOnRoad,
};
