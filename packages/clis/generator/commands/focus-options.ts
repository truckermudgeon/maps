import type { FocusOptions } from '@truckermudgeon/io';

export function parseFocusOptions(args: {
  focusCity?: string;
  focusGameCoords?: string;
  focusRadius: number;
}): FocusOptions | undefined {
  if (args.focusCity) {
    return {
      type: 'city',
      city: args.focusCity,
      radiusMeters: args.focusRadius,
    };
  }
  if (args.focusGameCoords) {
    const coords = args.focusGameCoords.split(',').map(c => parseFloat(c));
    if (coords.length !== 2 || coords.some(c => isNaN(c))) {
      throw new Error('invalid game coords');
    }
    return {
      type: 'coords',
      coords: coords as [number, number],
      radiusMeters: args.focusRadius,
    };
  }
  return undefined;
}
