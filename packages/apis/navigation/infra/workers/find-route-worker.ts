import type { Context, RouteKey } from '@truckermudgeon/map/routing';
import { findRouteFromKey } from '@truckermudgeon/map/routing';
import type { GameContext } from '../../domain/game-context';

export interface Options {
  key: RouteKey;
  routeContext: Context;
  gameContext: GameContext;
}

export default function (routeOptions: Options) {
  const { key, routeContext } = routeOptions;
  return findRouteFromKey(key, routeContext);
}
