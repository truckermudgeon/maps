import type { Position } from '@truckermudgeon/base/geom';
import { lineString } from '@turf/helpers';
import type { TruckSimTelemetry } from '../../../types';
import { fromPosAndBearing } from '../game-state';
import { scoreLine } from '../score-line';
import { aTruckWith } from './builders';

const lineWestToEast = lineString([
  [10, 10],
  [11, 10], // East of the first point
]).geometry;

const lineWestToEastToNorth = lineString([
  [10, 10],
  [10.01, 10],
  [10.01, 10.01], // North of the second point
]).geometry;

function genTruck(
  lngLat: Position,
  headingDegrees: number, // [0(north), 360) CW
): TruckSimTelemetry['truck'] {
  const { position, orientation } = fromPosAndBearing(lngLat, headingDegrees);

  return aTruckWith({
    position,
    orientation,
  });
}

describe('score line', () => {
  it('returns a score of 1 for driving perfectly forward', () => {
    const truck = genTruck([10, 10], 90);
    const score = scoreLine(lineWestToEast, truck);
    expect(score).toBeCloseTo(1);
  });

  it('returns a score of -1 for driving perfectly backward', () => {
    const truck = genTruck([10, 10], 270);
    const score = scoreLine(lineWestToEast, truck);
    expect(score).toBeCloseTo(-1);
  });

  it('returns a score near 0 for driving perpendicular to the road', () => {
    const truck = genTruck([10, 10], 0);
    const score = scoreLine(lineWestToEast, truck);
    expect(score).toBeCloseTo(0);
  });

  it('returns a lower score when driving parallel but off the road', () => {
    const truck = genTruck([10.005, 10.00018], 90); // Approximately 20 meters North of the road
    const score = scoreLine(lineWestToEast, truck);
    expect(score).toBeLessThan(1);
    expect(score).toBeGreaterThan(0);
  });

  it('returns a very low score when far away from the road', () => {
    const truck = genTruck([10.005, 10.0018], 90); // Approximately 200 meters North of the road
    const score = scoreLine(lineWestToEast, truck);
    expect(score).toBeCloseTo(0);
  });

  it('returns a positive score for driving at a 45-degree angle', () => {
    const truck = genTruck([10.005, 10], 45); // northeast
    const score = scoreLine(lineWestToEast, truck);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('handles the second segment of a complex road', () => {
    // On the second segment (heading North)
    const truck = genTruck([10.01, 10.005], 0);
    const score = scoreLine(lineWestToEastToNorth, truck);
    expect(score).toBeCloseTo(1);
  });

  it('returns 0 for being beyond the end of a complex road', () => {
    // On the second segment (heading North)
    const truck = genTruck([10.01, 10.02], 0);
    const score = scoreLine(lineWestToEastToNorth, truck);
    expect(score).toBeCloseTo(0);
  });

  it('handles going backward on the second segment of a complex road', () => {
    const truck = genTruck([10.01, 10.005], 180);
    const score = scoreLine(lineWestToEastToNorth, truck);
    expect(score).toBeCloseTo(-1);
  });

  it('returns 0 if the path is 2 degenerate points', () => {
    const singlePointRoad = lineString([
      [10, 10],
      [10, 10],
    ]).geometry;
    const truck = genTruck([10, 10], 90);
    const score = scoreLine(singlePointRoad, truck);
    expect(score).toBe(0);
  });

  it('returns 0 if the path is 3 degenerate points', () => {
    const singlePointRoad = lineString([
      [10, 10],
      [10, 10],
      [10, 10],
    ]).geometry;
    const truck = genTruck([10, 10], 90);
    const score = scoreLine(singlePointRoad, truck);
    expect(score).toBe(0);
  });
});
