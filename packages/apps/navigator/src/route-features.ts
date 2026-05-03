import polyline from '@mapbox/polyline';
import type { Route, RouteStep } from '@truckermudgeon/navigation/types';
import bearing from '@turf/bearing';
import { featureCollection, lineString, point } from '@turf/helpers';

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
