import type { Position } from '@truckermudgeon/base/geom';
import type { ContourFeature } from '@truckermudgeon/map/types';
import * as cliProgress from 'cli-progress';
import { tricontour } from 'd3-tricontour';
import polygonclipping from 'polygon-clipping';
import { logger } from '../logger';
import { createNormalizeFeature } from './normalize';

export function convertToContoursGeoJson({
  map,
  points,
}: {
  map: 'usa' | 'europe';
  points: readonly [number, number, number][];
}) {
  const normalizeCoordinates = createNormalizeFeature(map, 4);
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p[2] < min) {
      min = p[2];
    }
    if (p[2] > max) {
      max = p[2];
    }
  }
  const levels = max - min + 1;

  logger.log('calculating sector mask...');
  const sectors = new Set<string>();
  const boxes: [number, number][][][] = [];
  for (const p of points) {
    const sx = Math.floor(p[0] / 4000);
    const sy = Math.floor(p[1] / 4000);
    const key = `${sx}/${sy}`;
    if (sectors.has(key)) {
      continue;
    }
    sectors.add(key);

    const minx = sx * 4000;
    const miny = sy * 4000;
    const maxx = minx + 4000;
    const maxy = miny + 4000;
    boxes.push([
      [
        [minx, miny],
        [maxx, miny],
        [maxx, maxy],
        [minx, maxy],
        [minx, miny],
      ],
    ]);
  }
  const sectorUnion = polygonclipping.union(boxes[0], ...boxes.slice(1));

  logger.start(
    'calculating',
    levels,
    map,
    'contour levels',
    `(${min} min, ${max} max)`,
  );
  const tric = tricontour();

  const start = Date.now();
  const bar = new cliProgress.SingleBar(
    {
      format: `[{bar}] | {value} of {total}`,
      stopOnComplete: true,
      clearOnComplete: true,
    },
    cliProgress.Presets.rect,
  );
  bar.start(levels, 0);

  const features: ContourFeature[] = [];
  tric.thresholds(Array.from({ length: levels }, (_, i) => i + min));
  for (const c of tric.contours(points.slice())) {
    const { value, type, coordinates } = c;
    const intersection = polygonclipping.intersection(
      sectorUnion,
      coordinates as Position[][][],
    );
    features.push(
      normalizeCoordinates({
        type: 'Feature',
        properties: { elevation: value },
        geometry: { type, coordinates: intersection },
      }),
    );
    bar.increment();
  }

  logger.success(
    levels,
    'contours calculated and masked in',
    (Date.now() - start) / 1000,
    'seconds',
  );

  return {
    type: 'FeatureCollection',
    features,
  } as const;
}
