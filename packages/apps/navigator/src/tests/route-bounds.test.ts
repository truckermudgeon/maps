import polyline from '@mapbox/polyline';
import type {
  RouteStep,
  RouteWithSummary,
  StepManeuver,
} from '@truckermudgeon/navigation/types';
import bearing from '@turf/bearing';
import {
  defaultImperialOptions,
  defaultMetricOptions,
} from '../components/text';
import {
  bboxesToCornerPairs,
  bboxToCornerPair,
  bearingAfterStepManeuver,
  roundTrailerPoint,
  sortedRoutePreviewIndices,
  toRouteSummary,
} from '../route-bounds';

const stubStep = (overrides: Partial<RouteStep>): RouteStep => ({
  maneuver: {} as StepManeuver,
  geometry: '',
  distanceMeters: 0,
  duration: 0,
  nodesTraveled: 0,
  trafficIcons: [],
  ...overrides,
});

const stubRoute = (id: string): RouteWithSummary =>
  ({ id }) as RouteWithSummary;

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

describe('bboxToCornerPair', () => {
  it.each([
    {
      name: 'positive coords',
      b: [1, 2, 3, 4] as const,
      expected: [
        [1, 2],
        [3, 4],
      ],
    },
    {
      name: 'mixed signs',
      b: [-10, -5, 10, 5] as const,
      expected: [
        [-10, -5],
        [10, 5],
      ],
    },
    {
      name: 'degenerate (single point)',
      b: [3, 4, 3, 4] as const,
      expected: [
        [3, 4],
        [3, 4],
      ],
    },
  ])('extracts corner pair: $name', ({ b, expected }) => {
    expect(bboxToCornerPair(b)).toEqual(expected);
  });
});

describe('bboxesToCornerPairs', () => {
  it('returns [] for empty input', () => {
    expect(bboxesToCornerPairs([])).toEqual([]);
  });

  it('returns 2 corner points for single bbox', () => {
    expect(bboxesToCornerPairs([[1, 2, 3, 4]])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('flattens corner pairs for multiple bboxes', () => {
    expect(
      bboxesToCornerPairs([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ]),
    ).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
  });
});

describe('sortedRoutePreviewIndices', () => {
  const a = stubRoute('a');
  const b = stubRoute('b');
  const c = stubRoute('c');

  it.each([
    {
      name: 'highlighted at index 0',
      routes: [a, b, c],
      selected: { id: 'a' },
      expected: [1, 2, 0],
    },
    {
      name: 'highlighted at index 1',
      routes: [a, b, c],
      selected: { id: 'b' },
      expected: [0, 2, 1],
    },
    {
      name: 'highlighted at index 2',
      routes: [a, b, c],
      selected: { id: 'c' },
      expected: [0, 1, 2],
    },
    {
      name: 'no selection (undefined)',
      routes: [a, b, c],
      selected: undefined,
      expected: [0, 1, 2],
    },
    {
      name: 'selection not present in routes',
      routes: [a, b, c],
      selected: { id: 'x' },
      expected: [0, 1, 2],
    },
    {
      name: 'empty routes list',
      routes: [],
      selected: { id: 'a' },
      expected: [0, 1, 2],
    },
    {
      name: 'single route, matching selection',
      routes: [a],
      selected: { id: 'a' },
      expected: [1, 2, 0],
    },
  ])('$name', ({ routes, selected, expected }) => {
    expect(sortedRoutePreviewIndices(routes, selected)).toEqual(expected);
  });
});

describe('roundTrailerPoint', () => {
  it('returns undefined for undefined input', () => {
    expect(roundTrailerPoint(undefined)).toBeUndefined();
  });

  it.each([
    {
      name: 'rounds to 6 decimal places',
      input: [1.1234567, 2.9876543] as [number, number],
      expected: [1.123457, 2.987654] as [number, number],
    },
    {
      name: 'leaves zero unchanged',
      input: [0, 0] as [number, number],
      expected: [0, 0] as [number, number],
    },
    {
      name: 'leaves already-precise value unchanged',
      input: [-180.0001, 90.0001] as [number, number],
      expected: [-180.0001, 90.0001] as [number, number],
    },
    {
      name: 'preserves negative zero behavior on truncation',
      input: [0.1234561, -0.1234564] as [number, number],
      expected: [0.123456, -0.123456] as [number, number],
    },
  ])('$name', ({ input, expected }) => {
    expect(roundTrailerPoint(input)).toEqual(expected);
  });
});

describe('toRouteSummary', () => {
  it('returns zero minutes and zero distance for undefined input', () => {
    const result = toRouteSummary(undefined, defaultImperialOptions);
    expect(result.minutes).toBe(0);
    expect(result.distance.length).toBe(0);
  });

  it('passes minutes through unchanged', () => {
    const result = toRouteSummary(
      { minutes: 42, distanceMeters: 1000 },
      defaultMetricOptions,
    );
    expect(result.minutes).toBe(42);
  });

  it('formats distance with the given options (metric)', () => {
    const result = toRouteSummary(
      { minutes: 0, distanceMeters: 5_000 },
      defaultMetricOptions,
    );
    expect(result.distance.unit).toBe('km');
  });

  it('formats distance with the given options (imperial)', () => {
    const result = toRouteSummary(
      { minutes: 0, distanceMeters: 1609 },
      defaultImperialOptions,
    );
    expect(result.distance.unit).toBe('mi');
  });
});
