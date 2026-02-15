import type { Context, RouteKey } from '@truckermudgeon/map/routing';
import { findRouteFromKey } from '@truckermudgeon/map/routing';

export interface Options {
  key: RouteKey;
  routeContext: Context;
}

export default function (routeOptions: Options) {
  const { key, routeContext } = routeOptions;
  return findRouteFromKey(key, routeContext);
}
