import type { Route, RouteStep } from '@truckermudgeon/navigation/types';
import { describe, expect, it } from 'vitest';
import { getNextStep, routeSummaryReducer } from '../route-geometry';

function step(overrides: Partial<RouteStep> = {}): RouteStep {
  return {
    duration: 0,
    distanceMeters: 0,
    nodesTraveled: 0,
    geometry: '',
    ...overrides,
  } as RouteStep;
}

function route(stepsPerSegment: RouteStep[][]): Route {
  return {
    segments: stepsPerSegment.map(steps => ({ steps })),
  } as unknown as Route;
}

describe('getNextStep', () => {
  it('returns the next step within a segment', () => {
    const a = step();
    const b = step();
    expect(getNextStep(a, route([[a, b]]))).toBe(b);
  });

  it('crosses segment boundaries', () => {
    const a = step();
    const b = step();
    expect(getNextStep(a, route([[a], [b]]))).toBe(b);
  });

  it('returns undefined for the last step', () => {
    const a = step();
    expect(getNextStep(a, route([[a]]))).toBeUndefined();
  });

  it('returns undefined when the step is not in the route', () => {
    const orphan = step();
    expect(getNextStep(orphan, route([[step()]]))).toBeUndefined();
  });

  it('returns undefined for an empty route', () => {
    expect(getNextStep(step(), route([]))).toBeUndefined();
  });
});

describe('routeSummaryReducer', () => {
  const initial = () => ({
    duration: 0,
    distanceMeters: 0,
    activeRouteNodeIndex: 0,
  });

  it('counts a single step in full at index 0 when no nodes traveled', () => {
    const result = [
      step({ duration: 60, distanceMeters: 1000, nodesTraveled: 10 }),
    ].reduce(routeSummaryReducer, initial());
    expect(result).toEqual({
      duration: 60,
      distanceMeters: 1000,
      activeRouteNodeIndex: 0,
    });
  });

  it('counts the index-0 step partially when truck is mid-step', () => {
    const result = [
      step({ duration: 100, distanceMeters: 1000, nodesTraveled: 10 }),
    ].reduce(routeSummaryReducer, {
      duration: 0,
      distanceMeters: 0,
      activeRouteNodeIndex: 4, // 6/10 of the step still ahead
    });
    expect(result.duration).toBeCloseTo(60);
    expect(result.distanceMeters).toBeCloseTo(600);
  });

  it('counts subsequent steps in full regardless of activeRouteNodeIndex', () => {
    const result = [
      step({ duration: 100, distanceMeters: 1000, nodesTraveled: 10 }),
      step({ duration: 50, distanceMeters: 500, nodesTraveled: 5 }),
    ].reduce(routeSummaryReducer, {
      duration: 0,
      distanceMeters: 0,
      activeRouteNodeIndex: 5, // half through step 0
    });
    expect(result.duration).toBeCloseTo(50 + 50);
    expect(result.distanceMeters).toBeCloseTo(500 + 500);
  });

  it('treats a zero-nodesTraveled step as zero contribution (NaN guard)', () => {
    // Arrival-style step: divide-by-zero in stepFraction → NaN → guarded to 0.
    const result = [
      step({ duration: 30, distanceMeters: 200, nodesTraveled: 0 }),
    ].reduce(routeSummaryReducer, initial());
    expect(result).toEqual({
      duration: 0,
      distanceMeters: 0,
      activeRouteNodeIndex: 0,
    });
  });
});
