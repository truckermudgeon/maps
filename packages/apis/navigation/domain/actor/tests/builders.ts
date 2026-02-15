import polyline from '@mapbox/polyline';
import type { Position } from '@truckermudgeon/base/geom';
import { ItemType } from '@truckermudgeon/map/constants';
import type { Node, Road } from '@truckermudgeon/map/types';
import { BranchType } from '../../../constants';
import type {
  Route,
  RouteSegment,
  RouteStep,
  TruckSimTelemetry,
} from '../../../types';
import type { RouteWithLookup } from '../generate-routes';

export function lookupForNodeUids(
  nodeUids: bigint[][],
): RouteWithLookup['lookup'] {
  return {
    nodeUids,
    nodeUidsFlat: nodeUids.flat(),
    nodeUidsSet: new Set(nodeUids.flat()),
  };
}

export function aRouteWith(
  route: Partial<Omit<Route, 'duration' | 'distanceMeters'>> &
    Pick<Route, 'segments'>,
): Route {
  return {
    id: 'route',
    ...route,
    ...route.segments.reduce(
      (acc, segment) => ({
        distanceMeters: acc.distanceMeters + segment.distanceMeters,
        duration: acc.duration + segment.duration,
      }),
      { distanceMeters: 0, duration: 0 },
    ),
  };
}

export function aRouteWithLookup(
  routeWithLookup: Partial<
    Omit<RouteWithLookup, 'duration' | 'distanceMeters'>
  > &
    Pick<RouteWithLookup, 'segments' | 'lookup'>,
): RouteWithLookup {
  return {
    ...aRouteWith(routeWithLookup),
    lookup: routeWithLookup.lookup,
  };
}

export function aSegmentWith(
  segment: Partial<Omit<RouteSegment, 'distanceMeters' | 'duration'>> &
    Pick<RouteSegment, 'steps'>,
): RouteSegment {
  return {
    key: '0-0-forward-fastest',
    strategy: 'shortest',
    score: 0,
    ...segment,
    ...segment.steps.reduce(
      (acc, step) => ({
        distanceMeters: acc.distanceMeters + step.distanceMeters,
        duration: acc.duration + step.duration,
      }),
      { distanceMeters: 0, duration: 0 },
    ),
  };
}

export function aSegmentWithSteps(steps: RouteStep[]): RouteSegment {
  return aSegmentWith({ steps });
}

export function aStepWith(
  step: Partial<Omit<RouteStep, 'geometry'>> & { geometry: Position[] },
): RouteStep {
  const geometry = polyline.encode(step.geometry);
  return {
    maneuver: {
      direction: BranchType.RIGHT,
      lonLat: step.geometry[0],
    },
    distanceMeters: 1,
    duration: 1,
    nodesTraveled: 1,
    trafficIcons: [],
    ...step,
    geometry,
  };
}

export function aRoadWith(road: Partial<Road>): Road {
  return {
    uid: 0n,
    type: ItemType.Road,
    x: 0,
    y: 0,
    dlcGuard: 0,
    roadLookToken: 'look',
    startNodeUid: 0n,
    endNodeUid: 0n,
    length: 0,
    ...road,
  };
}

export function aNodeWith(node: Partial<Node>): Node {
  return {
    backwardCountryId: 0,
    backwardItemUid: 0n,
    forwardCountryId: 0,
    forwardItemUid: 0n,
    rotation: 0,
    rotationQuat: [0, 0, 0, 0],
    uid: 0n,
    x: 0,
    y: 0,
    z: 0,
    ...node,
  };
}

export function aTruckWith(
  truck: Partial<TruckSimTelemetry['truck']>,
): TruckSimTelemetry['truck'] {
  const dummyVector = { X: 0, Y: 0, Z: 0 };
  return {
    position: dummyVector,
    orientation: { heading: 0 },
    speed: {
      value: 0,
      kph: 0,
      mph: 0,
    },
    acceleration: {
      linearVelocity: dummyVector,
      linearAcceleration: dummyVector,
      angularVelocity: dummyVector,
      angularAcceleration: dummyVector,
    },
    ...truck,
  };
}

export const aTelemetryWith = (
  t: Partial<TruckSimTelemetry>,
): TruckSimTelemetry => {
  return {
    game: {
      scale: 0,
      paused: false,
      time: { value: 0 },
      timestamp: { value: 0 },
      game: { name: 'ats' },
    },
    job: {
      destination: {
        city: { id: '', name: '' },
        company: { id: '', name: '' },
      },
      source: {
        city: { id: '', name: '' },
        company: { id: '', name: '' },
      },
    },
    navigation: { speedLimit: { value: 0, kph: 0, mph: 0 } },
    trailer: {
      attached: false,
      orientation: { heading: 0 },
      position: { X: 0, Y: 0, Z: 0 },
    },
    truck: aTruckWith({}),
    ...t,
  };
};
