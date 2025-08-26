import { Preconditions } from './precon';

export function rotateRight<T>(arr: readonly T[], count: number): T[] {
  Preconditions.checkArgument(0 <= count && count < arr.length);
  if (count === 0) {
    return arr.slice();
  }

  return arr.slice(-count, arr.length).concat(arr.slice(0, -count));
}
