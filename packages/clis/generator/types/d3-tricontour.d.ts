import 'd3-tricontour';
import { GeoJSON } from 'geojson';

declare module 'd3-tricontour' {
  type Contour = GeoJSON.MultiPolygon & { value: number };

  export function tricontour<
    T = [number, number, number],
  >(): TricontourFunction<T> & TricontourGenerator<T>;

  type TricontourFunction<T> = (data: T[]) => Contour[];

  export type TricontourGenerator<T> = {
    x: (t: T) => number;
    y: (t: T) => number;
    value: (t: T) => number;

    thresholds(ts: number[]): this;
    thresholds(num: number): this;
    thresholds(): number[];

    contour(ts: T[], threshold: number): Contour;

    contours(ts: T[]): Iterable<Contour>;
  };
}
