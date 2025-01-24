import { assertExists } from '@truckermudgeon/base/assert';
import type { Route } from '@truckermudgeon/navigation/types';
import { Marker } from 'react-map-gl/maplibre';

// TODO simplify this, and/or move logic to store, as a computed
export const TrailerOrWaypointMarkers = (props: {
  trailerPoint: [lon: number, lat: number] | undefined;
  activeRoute: Route | undefined;
}) => {
  console.log('render trailer or waypoints');
  if (props.trailerPoint) {
    return (
      <Marker
        color={'#0f0'}
        longitude={props.trailerPoint[0]}
        latitude={props.trailerPoint[1]}
      />
    );
  }
  if (!props.activeRoute) {
    return null;
  }
  const waypoints = [];
  const numSegments = props.activeRoute.segments.length;
  for (let i = 0; i < numSegments; i++) {
    const segment = props.activeRoute.segments[i];
    const segmentEnd = assertExists(segment.lonLats.at(-1));
    const isLastSegment = i === numSegments - 1;
    waypoints.push(
      <Marker
        key={segmentEnd.join() + i}
        color={isLastSegment ? 'red' : 'blue'}
        longitude={segmentEnd[0]}
        latitude={segmentEnd[1]}
      />,
    );
  }
  return waypoints;
};
