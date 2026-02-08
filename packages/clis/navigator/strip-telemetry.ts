import type { TruckSimTelemetry } from '@truckermudgeon/navigation/types';
import type { TelemetryData } from 'trucksim-telemetry';

export function strip(t: TelemetryData): TruckSimTelemetry {
  return {
    navigation: {
      speedLimit: t.navigation.speedLimit,
    },
    truck: {
      speed: t.truck.speed,
      position: t.truck.position,
      orientation: {
        heading: t.truck.orientation.heading,
      },
      acceleration: {
        linearVelocity: t.truck.acceleration.linearVelocity ?? {
          X: 0,
          Y: 0,
          Z: 0,
        },
        linearAcceleration: t.truck.acceleration.linearAcceleration ?? {
          X: 0,
          Y: 0,
          Z: 0,
        },
        angularVelocity: t.truck.acceleration.angularVelocity,
        angularAcceleration: t.truck.acceleration.angularAcceleration,
      },
    },
    trailer: {
      position: t.trailer.position,
      orientation: {
        heading: t.trailer.orientation.heading,
      },
      attached: t.trailer.attached,
    },
    job: {
      destination: t.job.destination,
      source: t.job.source,
    },
    game: {
      game: {
        name: t.game.game.name,
      },
      paused: t.game.paused,
      timestamp: {
        value: t.game.timestamp.value,
      },
      time: {
        value: t.game.time.value,
      },
      scale: t.game.scale,
    },
  };
}
