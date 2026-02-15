import type { Position } from '@truckermudgeon/base/geom';
import { normalizeRadians, toRadians } from '@truckermudgeon/base/geom';
import bearing from '@turf/bearing';
import { point } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import pointToLineDistance from '@turf/point-to-line-distance';
import type { GeoJSON } from 'geojson';
import type { TruckSimTelemetry } from '../../types';
import { toPosAndBearing } from './game-state';

export function scoreLine(
  line: GeoJSON.LineString,
  truck: Pick<TruckSimTelemetry['truck'], 'position' | 'orientation'>,
): number {
  const { position, bearing } = toPosAndBearing(truck);
  return scoreLineSigned(line, position, toRadians(bearing));
}

function scoreLineSigned(
  line: GeoJSON.LineString,
  truckPos: Position,
  truckHeading: number,
): number {
  const weight = distanceWeightExp(truckPos, line, 20);
  if (weight === 0) {
    return 0;
  }

  const lineHeading = localLineHeadingRadians(truckPos, line);
  const alignment = signedHeadingAlignment(truckHeading, lineHeading);
  return alignment * weight; // [-1, 1]
}

function localLineHeadingRadians(
  truckPos: Position,
  line: GeoJSON.LineString,
): number {
  const snapped = nearestPointOnLine(line, truckPos);
  const idx = snapped.properties.index;
  const coords = line.coordinates;

  let a: number[];
  let b: number[];

  if (idx <= 0) {
    // at or before start of line
    a = coords[0];
    b = coords[1];
  } else if (idx >= coords.length - 1) {
    // at or past end of line
    a = coords[coords.length - 2];
    b = coords[coords.length - 1];
  } else {
    // middle of the line
    a = coords[idx];
    b = coords[idx + 1];
  }
  const lineBearing = bearing(point(a), point(b));
  return toRadians(lineBearing);
}

function distanceWeightExp(
  truckPos: Position,
  line: GeoJSON.LineString,
  decayMeters: number,
): number {
  try {
    const d = pointToLineDistance(truckPos, line, { units: 'meters' });
    return Math.exp(-d / decayMeters);
  } catch {
    // `pointToLineDistance` can throw if line is degenerate.
    return 0;
  }
}

function signedHeadingAlignment(
  truckHeading: number,
  lineHeading: number,
): number {
  const diff = normalizeRadians(truckHeading - lineHeading);
  return Math.cos(diff);
}
