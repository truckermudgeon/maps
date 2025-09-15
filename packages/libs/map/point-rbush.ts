import { Preconditions } from '@truckermudgeon/base/precon';
import RBush from 'rbush';
// not sure why `npx tsc -b` works, but eslint fails because of this line.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import knn from 'rbush-knn';

export class PointRBush<T extends { x: number; y: number }> extends RBush<T> {
  override toBBox({ x, y }: T) {
    return { minX: x, minY: y, maxX: x, maxY: y };
  }

  override compareMinX(a: T, b: T) {
    return a.x - b.x;
  }

  override compareMinY(a: T, b: T) {
    return a.y - b.y;
  }

  findAll(
    x: number,
    y: number,
    options: {
      radius?: number;
      maxResults?: number;
      predicate?: (t: T) => boolean;
    } = {},
  ): T[] {
    const {
      radius = Infinity,
      maxResults = Infinity,
      predicate = undefined,
    } = options;
    Preconditions.checkArgument(radius > 0);
    Preconditions.checkArgument(maxResults > 0);
    // i have no idea why these are needed. IDE says it's not required, but
    // running `npx eslint packages/*/*` will report errors without it. AND:
    // i'm disabling at the file level instead of at the line level because
    // the latter will result in eslint "fixing" the file by removing the
    // directive... which will then cause eslint to fail in CI. Arhghghghg.
    /* eslint @typescript-eslint/no-unsafe-return: 0 */
    /* eslint @typescript-eslint/no-unsafe-call: 0 */
    return knn(this, x, y, maxResults, predicate, radius);
  }

  findClosest(x: number, y: number): T;
  findClosest(
    x: number,
    y: number,
    options: {
      predicate?: (t: T) => boolean;
    },
  ): T;
  findClosest(
    x: number,
    y: number,
    options: {
      radius: number;
      predicate?: (t: T) => boolean;
    },
  ): T | undefined;
  findClosest(
    x: number,
    y: number,
    options: {
      radius?: number;
      predicate?: (t: T) => boolean;
    } = {},
  ): T | undefined {
    const { radius = Infinity } = options;
    const result = this.findAll(x, y, { ...options, radius, maxResults: 1 })[0];
    if (Number.isFinite(radius) && !result) {
      throw new Error('unexpected no results. Is the RBush empty?');
    }
    return result;
  }
}
