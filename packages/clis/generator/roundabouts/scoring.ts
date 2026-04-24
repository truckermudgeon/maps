import type { Position } from '@truckermudgeon/base/geom';
import { distance } from '@truckermudgeon/base/geom';
import { Preconditions } from '@truckermudgeon/base/precon';

export function circularityByRadius(coords: [number, number][]): {
  center: Position;
  meanRadius: number;
  score: number;
} {
  // centroid
  const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;

  // center
  //const [cx, cy] = center(getExtent(coords));

  const distances = coords.map(pos => distance(pos, [cx, cy]));

  const mean = distances.reduce((s, d) => s + d, 0) / distances.length;

  const variance =
    distances.reduce((s, d) => s + (d - mean) ** 2, 0) / distances.length;

  const stdDev = Math.sqrt(variance);

  return {
    center: [cx, cy] as [number, number],
    meanRadius: mean,
    score: stdDev / mean, // 🔥 key metric
  };
}

export function turningConsistency(coords: [number, number][]): {
  score: number;
  direction: -1 | 0 | 1;
} {
  let positive = 0;
  let negative = 0;

  for (let i = 1; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i - 1];
    const [x2, y2] = coords[i];
    const [x3, y3] = coords[i + 1];

    const cross = (x2 - x1) * (y3 - y2) - (y2 - y1) * (x3 - x2);

    if (cross > 0) positive++;
    if (cross < 0) negative++;
  }

  const total = positive + negative;
  const dominant = Math.max(positive, negative);

  return {
    score: total === 0 ? 0 : dominant / total,
    direction: positive > negative ? 1 : positive === negative ? 0 : -1,
  };
}

/**
 * Scores how close an aspect ratio is to 1:1.
 * Returns a value between 0 and 1.
 *
 * @param ratio width / height (must be > 0)
 * @param sigma controls tolerance (smaller = stricter)
 */
export function aspectRatioScore(ratio: number, sigma = 0.1): number {
  Preconditions.checkArgument(ratio > 0);
  const logDiff = Math.log(ratio); // symmetric around 1
  return Math.exp(-(logDiff * logDiff) / (2 * sigma * sigma));
}

const radiusThreshold = 70;
export function meanRadiusScore(radius: number, decay = 10): number {
  if (radius <= radiusThreshold) {
    return 1;
  }

  return Math.exp(-(radius - radiusThreshold) / decay);
}
