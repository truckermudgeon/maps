import { z } from 'zod';

export enum PoiType {
  COMPANY,
  FUEL,
  REST,
  SERVICE,
  DEALER,
  RECRUITING,
}

export enum ScopeType {
  NEARBY,
  ROUTE,
}

export const enum BranchType {
  THROUGH,
  SLIGHT_LEFT,
  LEFT,
  SHARP_LEFT,
  U_TURN_LEFT,
  SLIGHT_RIGHT = 11,
  RIGHT,
  SHARP_RIGHT,
  U_TURN_RIGHT,
  MERGE = -1,
}

const RouteSegmentSchema = z.object({
  key: z.string(),
  lonLats: z.array(z.tuple([z.number(), z.number()])),
  distance: z.number(),
  time: z.number(),
  strategy: z.enum(['shortest', 'smallRoads']),
});

export const RouteSchema = z.object({
  id: z.string(),
  segments: z.array(RouteSegmentSchema),
});
