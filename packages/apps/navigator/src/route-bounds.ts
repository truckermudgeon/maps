import polyline from '@mapbox/polyline';
import type {
  Route,
  RouteStep,
  RouteWithSummary,
} from '@truckermudgeon/navigation/types';
import { bbox } from '@turf/bbox';
import bearing from '@turf/bearing';
import { featureCollection, lineString, point } from '@turf/helpers';
import { toLengthAndUnit } from './components/text';

type ToLengthAndUnitOptions = Parameters<typeof toLengthAndUnit>[1];
type Bbox2D = readonly [number, number, number, number];

export function toRouteFeatures(
  route: Route,
): GeoJSON.FeatureCollection<GeoJSON.Point | GeoJSON.LineString> {
  // TODO define a type for these Point properties
  const iconFeatures: GeoJSON.Feature<GeoJSON.Point>[] = route.segments.flatMap(
    segment =>
      segment.steps.flatMap(step =>
        step.trafficIcons.flatMap(icon =>
          point(icon.lonLat, {
            type: 'traffic',
            sprite: icon.type === 'stop' ? 'stopsign' : 'trafficlight',
          }),
        ),
      ),
  );
  if (route.segments.length && route.segments[0].steps.length) {
    const firstStep = route.segments[0].steps[0];
    const coords = polyline.decode(firstStep.geometry);
    iconFeatures.push(point(coords[0], { type: 'startOrEnd' }));

    const lastStep = route.segments.at(-1)!.steps.at(-1);
    if (lastStep) {
      const coords = polyline.decode(lastStep.geometry);
      iconFeatures.push(point(coords.at(-1)!, { type: 'startOrEnd' }));
    }
  }

  return featureCollection<GeoJSON.Point | GeoJSON.LineString>([
    lineString(
      route.segments.flatMap(segment =>
        segment.steps.flatMap(step => polyline.decode(step.geometry)),
      ),
    ),
    ...iconFeatures,
  ]);
}

export function bearingAfterStepManeuver(step: RouteStep): number {
  if (!step.arrowPoints || step.arrowPoints < 2) {
    return 0;
  }
  const arrowPoints = polyline.decode(step.geometry).slice(0, step.arrowPoints);
  return bearing(arrowPoints[0], arrowPoints[1]);
}

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

export function sortedRoutePreviewIndices(
  routes: readonly RouteWithSummary[],
  selectedRoute: { id: string } | undefined,
): number[] {
  const highlightedIndex = routes.findIndex(r => r.id === selectedRoute?.id);
  return [0, 1, 2].sort((a, b) =>
    a === highlightedIndex ? 1 : b === highlightedIndex ? -1 : a - b,
  );
}

export function toRouteSummary(
  s: { distanceMeters: number; minutes: number } | undefined,
  options: ToLengthAndUnitOptions,
): { minutes: number; distance: ReturnType<typeof toLengthAndUnit> } {
  return {
    minutes: s?.minutes ?? 0,
    distance: toLengthAndUnit(s?.distanceMeters ?? 0, options),
  };
}

export function roundTrailerPoint(
  point: readonly [number, number] | undefined,
): [number, number] | undefined {
  return point?.map(n => Number(n.toFixed(6))) as [number, number] | undefined;
}
