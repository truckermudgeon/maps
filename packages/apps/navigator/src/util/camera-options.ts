import type { Position } from '@truckermudgeon/base/geom';

/**
 * Angular delta in degrees from `currBearing` to `nextBearing`. Inputs
 * are expected in turf's (-180, 180] bearing convention.
 */
export function calculateDelta(
  currBearing: number,
  nextBearing: number,
): number {
  const normalizedCurr = currBearing % 360;
  const normalizedNext = nextBearing > 0 ? nextBearing : nextBearing + 360;
  let delta = normalizedNext - normalizedCurr;
  // Take the shorter arc when the raw delta wraps past 180°.
  if (delta > 180) {
    delta -= 360;
  }
  return delta;
}

/**
 * Map camera options derived from current speed and heading. Faster
 * speeds zoom out and reduce pitch. North-lock mode forces pitch and
 * bearing to 0 and drops zoom by 2 levels for a wider top-down view.
 */
export function toCameraOptions(
  center: Position,
  bearing: number,
  speedMph: number,
  options: { isNorthLock: boolean },
): {
  center: Position;
  zoom: number;
  pitch: number;
  bearing: number;
} {
  let zoom;
  let pitch;
  if (speedMph > 60) {
    zoom = 11;
    pitch = 30;
  } else if (speedMph > 30) {
    zoom = 12;
    pitch = 45;
  } else {
    zoom = 13;
    pitch = 50;
  }
  return {
    center,
    zoom: options.isNorthLock ? zoom - 2 : zoom,
    pitch: options.isNorthLock ? 0 : pitch,
    bearing: options.isNorthLock ? 0 : bearing,
  };
}
