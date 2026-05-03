import polyline from '@mapbox/polyline';
import type { RouteStep, StepManeuver } from '@truckermudgeon/navigation/types';
import bearing from '@turf/bearing';
import { bearingAfterStepManeuver } from '../route-features';

const stubStep = (overrides: Partial<RouteStep>): RouteStep => ({
  maneuver: {} as StepManeuver,
  geometry: '',
  distanceMeters: 0,
  duration: 0,
  nodesTraveled: 0,
  trafficIcons: [],
  ...overrides,
});

describe('bearingAfterStepManeuver', () => {
  it.each([
    { name: 'arrowPoints undefined', arrowPoints: undefined },
    { name: 'arrowPoints zero', arrowPoints: 0 },
    { name: 'arrowPoints one', arrowPoints: 1 },
  ])('returns 0 when $name', ({ arrowPoints }) => {
    expect(bearingAfterStepManeuver(stubStep({ arrowPoints }))).toBe(0);
  });

  it('returns the bearing between the first two arrow points when arrowPoints is 2', () => {
    const points: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    const geometry = polyline.encode(points);
    const expected = bearing(points[0], points[1]);
    expect(
      bearingAfterStepManeuver(stubStep({ geometry, arrowPoints: 2 })),
    ).toBe(expected);
  });

  it('uses only the first two of three arrow points', () => {
    const points: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    const geometry = polyline.encode(points);
    const expected = bearing(points[0], points[1]);
    expect(
      bearingAfterStepManeuver(stubStep({ geometry, arrowPoints: 3 })),
    ).toBe(expected);
  });
});
