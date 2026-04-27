import { Preconditions } from './precon';

export function rotateRight<T>(arr: readonly T[], count: number): T[] {
  Preconditions.checkArgument(0 <= count && count < arr.length);
  if (count === 0) {
    return arr.slice();
  }

  return arr.slice(-count, arr.length).concat(arr.slice(0, -count));
}

export function rotateFromIndex<T>(arr: T[], index: number): T[] {
  const len = arr.length;
  if (len === 0) {
    return arr;
  }

  // Normalize index (handles negative or out-of-range values)
  const i = ((index % len) + len) % len;

  return arr.slice(i).concat(arr.slice(0, i));
}
