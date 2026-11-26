import { PointRBush } from '@truckermudgeon/map/point-rbush';
import { fromWgs84ToEts2Coords } from '@truckermudgeon/map/projections';
import type { Node } from '@truckermudgeon/map/types';
import { describe, expect, it } from 'vitest';
import { fromPosAndBearing, toThemeMode } from '../game-state';
import {
  aCountryWith,
  aNodeWith,
  aTelemetryWith,
  aTruckWith,
} from './builders';

type NodeRTree = PointRBush<{ x: number; y: number; z: number; node: Node }>;

function makeRTree(lngLat: [number, number], countryId: number): NodeRTree {
  const [gx, gy] = fromWgs84ToEts2Coords(lngLat);
  const tree: NodeRTree = new PointRBush();
  tree.insert({
    x: gx,
    y: gy,
    z: 0,
    node: aNodeWith({
      x: gx,
      y: gy,
      forwardCountryId: countryId,
      backwardCountryId: countryId,
    }),
  });
  return tree;
}

function ets2TelemetryAt(
  lngLat: [number, number],
  minutesSinceMidnight: number,
) {
  const { position, orientation } = fromPosAndBearing(lngLat, 0, 'europe');
  return aTelemetryWith({
    game: {
      scale: 0,
      paused: false,
      time: { value: minutesSinceMidnight },
      timestamp: { value: 0 },
      game: { name: 'ets2' },
    },
    truck: aTruckWith({ position, orientation }),
  });
}

const reykjavikLngLat: [number, number] = [-22.0832, 63.924];
const iceland = aCountryWith({
  id: 1,
  token: 'iceland',
  name: 'Iceland',
  code: 'IS',
  timeZone: 0,
});

const brusselsLngLat: [number, number] = [3.8845, 50.6078];
const belgium = aCountryWith({
  id: 2,
  token: 'belgium',
  name: 'Belgium',
  code: 'BE',
  // UTC+2 CEST in summer
  timeZone: 120,
});

describe('toThemeMode', () => {
  describe('Reykjavik', () => {
    const rTree = makeRTree(reykjavikLngLat, iceland.id);
    const countries = new Map([[iceland.token, iceland]]);

    it.each([
      [120, 'dark'], // 02:00 - before sunrise
      [720, 'light'], // 12:00 - midday
      [23 * 60 + 59, 'light'], // 23:59 - a few seconds before sunset (23:59:06)
      [0, 'dark'], // 00:00 - let's call this 'right after sunset', since we can't specify a time with seconds resolution.
    ])('at %i min, returns "%s"', (minutes, expected) => {
      expect(
        toThemeMode(
          ets2TelemetryAt(reykjavikLngLat, minutes),
          countries,
          rTree,
        ),
      ).toBe(expected);
    });
  });

  describe('Brussels', () => {
    const rTree = makeRTree(brusselsLngLat, belgium.id);
    const countries = new Map([[belgium.token, belgium]]);

    it.each([
      [180, 'dark'], // 03:00 - before dawn
      [720, 'light'], // 12:00 - midday
      [23 * 60, 'dark'], // 23:00 - after sunset
    ])('at %i min, returns "%s"', (minutes, expected) => {
      expect(
        toThemeMode(ets2TelemetryAt(brusselsLngLat, minutes), countries, rTree),
      ).toBe(expected);
    });
  });
});
