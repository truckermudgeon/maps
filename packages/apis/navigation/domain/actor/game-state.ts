import { assert, assertExists } from '@truckermudgeon/base/assert';
import type { Position } from '@truckermudgeon/base/geom';
import { contains, toRadians } from '@truckermudgeon/base/geom';
import type { PointRBush } from '@truckermudgeon/map/point-rbush';
import {
  fromAtsCoordsToWgs84,
  fromWgs84ToAtsCoords,
} from '@truckermudgeon/map/projections';
import type { Country, Node } from '@truckermudgeon/map/types';
import bearing from '@turf/bearing';
import SunCalc from 'suncalc';
import type { GameState, TruckSimTelemetry } from '../../types';

export function toGameState(telemetry: TruckSimTelemetry): GameState {
  const {
    truck,
    truck: { acceleration },
  } = telemetry;
  const toXYZ = (pos: { X: number; Y: number; Z: number }) => ({
    x: pos.X,
    y: pos.Z,
    z: pos.Y,
  });

  return {
    paused: telemetry.game.paused,
    t: Math.floor(telemetry.game.timestamp.value / 1000),
    position: toXYZ(truck.position),
    heading: truck.orientation.heading,
    speed: truck.speed.value,
    linearAccel: toXYZ(acceleration.linearAcceleration),
    angularVelocity: toXYZ(acceleration.angularVelocity),
    angularAccel: toXYZ(acceleration.angularAcceleration),
    // world stuff
    speedLimit: telemetry.navigation.speedLimit.mph,
    scale: telemetry.game.scale,
  };
}

export function toThemeMode(
  telemetry: TruckSimTelemetry,
  countries: ReadonlyMap<string, Country>,
  graphNodeRTree: PointRBush<{
    x: number;
    y: number;
    z: number;
    node: Node;
  }>,
): 'light' | 'dark' {
  const totalMinutes = telemetry.game.time.value;
  const minutesInAnHour = 60;
  const minutesInADay = minutesInAnHour * 24;

  const hour = Math.floor((totalMinutes % minutesInADay) / minutesInAnHour);
  const minute = Math.floor((totalMinutes % minutesInADay) % minutesInAnHour);

  const { X: x, Z: y } = telemetry.truck.position;
  const [lng, lat] = fromAtsCoordsToWgs84([x, y]);
  const closestGraphNode = assertExists(
    graphNodeRTree.findClosest(x, y, {
      radius: 1_000, // need to specify something to prevent crazy-long queries
      predicate: ({ node }) =>
        node.forwardCountryId !== 0 &&
        node.forwardCountryId === node.backwardCountryId,
    }),
  ).node;
  const closestCountry = assertExists(
    countries.values().find(c => c.id === closestGraphNode.forwardCountryId),
  );

  // N.B.: already takes daylight savings into account.
  const timeZoneOffsetMinutes =
    closestCountry.secondaryTimeZones.find(tz => contains(tz.extent, [x, y]))
      ?.timeZone ?? closestCountry.timeZone;

  // assume full-hour TZ offsets
  const hourOffset = Math.floor(timeZoneOffsetMinutes / 60);
  // assume implementation can parse this lax string into a UTC date
  const now = new Date(
    // from def/env_data.sii:
    // 	  day_in_year: 172	//summer solstice
    // the 172nd day of a non-leap year is June 21.
    `June 21, 2025 ${hour}:${minute} GMT${hourOffset >= 0 ? '+' : ''}${hourOffset}`,
  );

  const { sunset, dawn } = SunCalc.getTimes(now, lat, lng);
  const nowTime = now.getTime();
  const sunsetTime = sunset.getTime();
  const dawnTime = dawn.getTime();

  // sanity check: suncalc always returns times where dawn < sunset
  // (i.e., it never returns a dawn for the next day, after sunset)
  assert(
    dawnTime < sunsetTime,
    `dawnTime(${dawnTime}) unexpectedly >= sunsetTime(${sunsetTime})`,
  );

  if (nowTime < dawnTime) {
    // before dawn
    return 'dark';
  } else if (nowTime < sunsetTime) {
    // after dawn and before sunset
    return 'light';
  } else {
    // after sunset
    return 'dark';
  }
}

export function toPosAndBearing(
  truck: Pick<TruckSimTelemetry['truck'], 'position' | 'orientation'>,
) {
  const position = fromAtsCoordsToWgs84([truck.position.X, truck.position.Z]);
  const theta =
    // do `0.5 - ...` here so that `lookAt` calculation works as expected; need
    // to provide a point in the y-flipped coordinate space.
    (0.5 - truck.orientation.heading) * Math.PI * 2 + Math.PI / 2;
  const lookAt = fromAtsCoordsToWgs84([
    truck.position.X + 1000 * Math.cos(theta),
    truck.position.Z + 1000 * Math.sin(theta),
  ]);
  return {
    position,
    bearing: bearing(position, lookAt, { final: false }),
  };
}

export function fromPosAndBearing(
  lngLat: Position,
  headingDegrees: number, // [0(north), 360) CW
): Pick<TruckSimTelemetry['truck'], 'position' | 'orientation'> {
  const headingRad = toRadians(-headingDegrees + 90);
  const lookAt: Position = [
    lngLat[0] + Math.cos(headingRad),
    lngLat[1] + Math.sin(headingRad),
  ];
  const a = fromWgs84ToAtsCoords(lngLat);
  const b = fromWgs84ToAtsCoords(lookAt);
  const twoPi = 2 * Math.PI;
  const theta = Math.atan2(
    // flip signs because game coord system
    -b[1] - -a[1],
    b[0] - a[0],
  );
  const shifted = theta - Math.PI / 2;
  const wrapped = ((shifted % twoPi) + twoPi) % twoPi;
  const unitHeading = wrapped / twoPi;

  return {
    position: {
      X: a[0],
      Y: 0,
      Z: a[1],
    },
    orientation: {
      heading: unitHeading,
    },
  };
}
