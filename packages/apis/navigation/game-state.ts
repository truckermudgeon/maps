import type { TruckSimTelemetry } from '@truckermudgeon/api/types';
import { fromAtsCoordsToWgs84 } from '@truckermudgeon/map/projections';
import bearing from '@turf/bearing';

export function toGameState(telemetry: TruckSimTelemetry) {
  const position = fromAtsCoordsToWgs84([
    telemetry.truck.position.X,
    telemetry.truck.position.Z,
  ]);
  const theta =
    (0.5 - telemetry.truck.orientation.heading) * Math.PI * 2 + Math.PI / 2;
  const lookAt = fromAtsCoordsToWgs84([
    telemetry.truck.position.X + 1000 * Math.cos(theta),
    telemetry.truck.position.Z + 1000 * Math.sin(theta),
  ]);

  return {
    position,
    bearing: bearing(position, lookAt, { final: false }),
    speedMph: telemetry.truck.speed.mph,
    speedLimit: telemetry.navigation.speedLimit.mph,
    scale: telemetry.game.scale,
  };
}
