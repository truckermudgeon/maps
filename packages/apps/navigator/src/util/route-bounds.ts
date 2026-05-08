import type { Route } from '@truckermudgeon/navigation/types';
import { bbox } from '@turf/bbox';
import { toRouteFeatures } from './route-features';

type Bbox2D = readonly [number, number, number, number];

export function bboxToCornerPair(
  b: Bbox2D,
): [[number, number], [number, number]] {
  const [minX, minY, maxX, maxY] = b;
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

export function bboxesToCornerPairs(bs: readonly Bbox2D[]): [number, number][] {
  return bs.flatMap(b => bboxToCornerPair(b));
}

export function routeCornerPair(
  route: Route,
): [[number, number], [number, number]] {
  return bboxToCornerPair(bbox(toRouteFeatures(route)) as Bbox2D);
}

export function routesCornerPairs(
  routes: readonly Route[],
): [number, number][] {
  return bboxesToCornerPairs(
    routes.map(r => bbox(toRouteFeatures(r)) as Bbox2D),
  );
}
