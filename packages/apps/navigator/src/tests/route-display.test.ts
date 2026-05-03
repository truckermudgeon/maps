import type { RouteWithSummary } from '@truckermudgeon/navigation/types';
import {
  defaultImperialOptions,
  defaultMetricOptions,
} from '../components/text';
import { sortedRoutePreviewIndices, toRouteSummary } from '../route-display';

const stubRoute = (id: string): RouteWithSummary =>
  ({ id }) as RouteWithSummary;

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
