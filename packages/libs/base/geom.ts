import { Preconditions } from './precon';

export type Position = [number, number];

type PositionLike = Position | number[] | { x: number; y: number };

/** minX, minY, maxX, maxY */
export type Extent = [number, number, number, number];

export function translate([x, y]: Position, [dx, dy]: Position): Position {
  return [x + dx, y + dy];
}

export function add(...positions: Position[]): Position {
  return positions.reduce((acc, p) => translate(acc, p));
}

/** Subtracts `b` from `a` */
export function subtract(a: PositionLike, b: PositionLike): Position {
  return withPositionLikes(a, b, (x1, y1, x2, y2) => [x1 - x2, y1 - y2]);
}

/** Scales `p` about `o` by a factor of `s` */
export function scale(
  [px, py]: Position,
  s: number,
  [ox, oy]: Position = [0, 0],
): Position {
  return [(px - ox) * s + ox, (py - oy) * s + oy];
}

export function nonUniformScale(
  [px, py]: Position,
  [sx, sy]: Position,
  [ox, oy]: Position = [0, 0],
): Position {
  return [(px - ox) * sx + ox, (py - oy) * sy + oy];
}

/** Rotates `p` about `o` by theta radians */
export function rotate(
  [px, py]: Position,
  theta: number,
  [ox, oy]: Position = [0, 0],
): Position {
  const sint = Math.sin(theta);
  const cost = Math.cos(theta);
  return [
    cost * (px - ox) - sint * (py - oy) + ox,
    sint * (px - ox) + cost * (py - oy) + oy,
  ];
}

export function distance(a: PositionLike, b: PositionLike): number {
  return withPositionLikes(a, b, (x1, y1, x2, y2) =>
    Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
  );
}

export function magnitude(p: Position) {
  return distance(p, [0, 0]);
}

export function midPoint(a: PositionLike, b: PositionLike): Position {
  return withPositionLikes(a, b, (x1, y1, x2, y2) => [
    (x1 + x2) / 2,
    (y1 + y2) / 2,
  ]);
}

export function dot([x1, y1]: Position, [x2, y2]: Position) {
  return x1 * x2 + y1 * y2;
}

export function center([minX, minY, maxX, maxY]: Extent): Position {
  return midPoint([minX, minY], [maxX, maxY]);
}

interface SplinePoint {
  position: Position;
  rotation: number;
}

export function toSplinePoints(
  start: SplinePoint,
  end: SplinePoint,
  steps?: number,
): Position[] {
  if (steps == null) {
    steps = Math.min(
      8,
      // 16: { 1 → 668, 2 → 100, 3 → 100, 4 → 96, 5 → 64, 6 → 44, 7 → 36, 8 → 300 }
      // 24: { 1 → 656, 2 → 40, 3 → 72, 4 → 56, 5 → 80, 6 → 60, 7 → 40, 8 → 404 }
      // 32: { 1 → 648, 2 → 20, 3 → 52, 4 → 48, 5 → 52, 6 → 48, 7 → 52, 8 → 488 }
      Math.floor(Math.abs(Math.tan(start.rotation - end.rotation)) * 20) + 1,
    );
  }
  Preconditions.checkArgument(steps > 0);
  const dist = distance(start.position, end.position);
  // cubic hermite interpolation
  // https://en.wikibooks.org/wiki/Cg_Programming/Unity/Hermite_Curves
  const p0 = start.position;
  const p1 = end.position;
  const m0 = scale([Math.cos(start.rotation), Math.sin(start.rotation)], dist);
  const m1 = scale([Math.cos(end.rotation), Math.sin(end.rotation)], dist);
  const res: Position[] = [];
  for (let i = 0; i < steps + 1; i++) {
    const t = i / steps;
    const t2 = Math.pow(t, 2);
    const t3 = Math.pow(t, 3);
    res.push(
      add(
        scale(p0, 2 * t3 - 3 * t2 + 1),
        scale(m0, t3 - 2 * t2 + t),
        scale(p1, -2 * t3 + 3 * t2),
        scale(m1, t3 - t2),
      ),
    );
  }
  return res;
}

/**
 * Returns the extent of `items`, in `[minX, minY, maxX, maxY]` form.
 */
export function getExtent(
  items: Iterable<{ x: number; y: number } | [number, number]>,
): Extent {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const i of items) {
    if (Array.isArray(i)) {
      minX = Math.min(minX, i[0]);
      maxX = Math.max(maxX, i[0]);
      minY = Math.min(minY, i[1]);
      maxY = Math.max(maxY, i[1]);
    } else {
      minX = Math.min(minX, i.x);
      maxX = Math.max(maxX, i.x);
      minY = Math.min(minY, i.y);
      maxY = Math.max(maxY, i.y);
    }
  }

  return [minX, minY, maxX, maxY];
}

export function withinExtent(
  point: [x: number, y: number],
  extent: Extent,
): boolean {
  const [x, y] = point;
  const [minX, minY, maxX, maxY] = extent;
  return minX <= x && x <= maxX && minY <= y && y <= maxY;
}

/**
 * Normalizes an angle between (-Pi, Pi]
 * @param theta
 */
export function normalizeRadians(theta: number) {
  const twoPi = Math.PI * 2;
  let normalized = theta % twoPi;
  normalized = (normalized + twoPi) % twoPi;
  return normalized <= Math.PI ? normalized : normalized - twoPi;
}

export function toRadians(deg: number) {
  return normalizeRadians((deg * Math.PI) / 180);
}

function withPositionLikes<T>(
  a: PositionLike,
  b: PositionLike,
  fn: (x1: number, y1: number, x2: number, y2: number) => T,
) {
  let x1, y1;
  if (Array.isArray(a)) {
    Preconditions.checkArgument(a.length >= 2);
    x1 = a[0];
    y1 = a[1];
  } else {
    x1 = a.x;
    y1 = a.y;
  }
  let x2, y2;
  if (Array.isArray(b)) {
    Preconditions.checkArgument(b.length >= 2);
    x2 = b[0];
    y2 = b[1];
  } else {
    x2 = b.x;
    y2 = b.y;
  }
  return fn(x1, y1, x2, y2);
}
