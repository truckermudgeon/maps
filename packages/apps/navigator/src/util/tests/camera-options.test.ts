import { describe, expect, it } from 'vitest';
import { calculateDelta, toCameraOptions } from '../camera-options';

describe('calculateDelta', () => {
  // Captures actual current behavior. The function is called with
  // turf-convention bearings (-180, 180]; samples in 0..360 with
  // forward seam-crossing aren't currently exercised by callers, so
  // those cases are pinned (not blessed) as characterization.
  it.each([
    { name: 'identity at 0', curr: 0, next: 0, expected: 0 },
    { name: 'forward 90 from 0', curr: 0, next: 90, expected: 90 },
    { name: 'forward 90 from 90', curr: 90, next: 180, expected: 90 },
    { name: 'wraps when raw delta > 180', curr: 10, next: 350, expected: -20 },
    {
      name: 'next === 0 normalizes via +360',
      curr: 270,
      next: 0,
      expected: 90,
    },
    {
      name: 'negative next normalizes via +360',
      curr: 0,
      next: -90,
      expected: -90,
    },
    {
      name: 'negative next: -90 from 270 yields 0',
      curr: 270,
      next: -90,
      expected: 0,
    },
    {
      // pinned bug: forward seam (350° -> 10°) returns the long-way-round
      // delta. Inputs in turf convention (next negative) avoid this; if
      // call sites change to 0..360 inputs, this case will need fixing.
      name: 'pinned: forward 350 -> 10 returns -340 (not blessed)',
      curr: 350,
      next: 10,
      expected: -340,
    },
  ])('$name', ({ curr, next, expected }) => {
    expect(calculateDelta(curr, next)).toBe(expected);
  });
});

describe('toCameraOptions', () => {
  const center: [number, number] = [-122.4, 37.8];

  it.each([
    {
      name: 'slow (0 mph), free',
      speedMph: 0,
      lock: false,
      zoom: 13,
      pitch: 50,
      bearing: 42,
    },
    {
      name: 'slow (30 mph) — boundary, falls into slow tier',
      speedMph: 30,
      lock: false,
      zoom: 13,
      pitch: 50,
      bearing: 42,
    },
    {
      name: 'medium (31 mph), free',
      speedMph: 31,
      lock: false,
      zoom: 12,
      pitch: 45,
      bearing: 42,
    },
    {
      name: 'medium (60 mph) — boundary, falls into medium tier',
      speedMph: 60,
      lock: false,
      zoom: 12,
      pitch: 45,
      bearing: 42,
    },
    {
      name: 'fast (61 mph), free',
      speedMph: 61,
      lock: false,
      zoom: 11,
      pitch: 30,
      bearing: 42,
    },
    {
      name: 'slow + north-lock zooms out and zeroes pitch/bearing',
      speedMph: 0,
      lock: true,
      zoom: 11,
      pitch: 0,
      bearing: 0,
    },
    {
      name: 'fast + north-lock zooms out and zeroes pitch/bearing',
      speedMph: 80,
      lock: true,
      zoom: 9,
      pitch: 0,
      bearing: 0,
    },
  ])('$name', ({ speedMph, lock, zoom, pitch, bearing }) => {
    expect(
      toCameraOptions(center, 42, speedMph, { isNorthLock: lock }),
    ).toEqual({
      center,
      zoom,
      pitch,
      bearing,
    });
  });
});
