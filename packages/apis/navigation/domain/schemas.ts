import { z } from 'zod';

export const SpeedSchema = z.object({
  value: z.number(), // m/s
  kph: z.number(),
  mph: z.number(),
});

export const PositionSchema = z.object({
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
});

export const OrientationSchema = z.object({
  // [0(north), 1], CCW
  heading: z.number().min(0).max(1),
});

export const JobLocationSchema = z.object({
  city: z.object({
    id: z.string().max(12),
    name: z.string().max(100),
  }),
  company: z.object({
    id: z.string().max(12),
    name: z.string().max(100),
  }),
});

export const TruckSimTelemetrySchema = z.object({
  navigation: z.object({
    speedLimit: SpeedSchema,
  }),
  truck: z.object({
    speed: SpeedSchema,
    position: PositionSchema,
    orientation: OrientationSchema,
    acceleration: z.object({
      linearVelocity: PositionSchema,
      linearAcceleration: PositionSchema,
      angularVelocity: PositionSchema,
      angularAcceleration: PositionSchema,
    }),
  }),
  trailer: z.object({
    attached: z.boolean(),
    position: PositionSchema,
    orientation: OrientationSchema,
  }),
  job: z.object({
    destination: JobLocationSchema,
    source: JobLocationSchema,
  }),
  game: z.object({
    game: z.object({
      name: z.string().max(4),
    }),
    paused: z.boolean(),
    timestamp: z.object({
      // goes up when game isn't paused
      value: z.number(),
    }),
    time: z.object({
      // minutes since Day 0
      value: z.number(),
    }),
    scale: z.number(),
  }),
});
