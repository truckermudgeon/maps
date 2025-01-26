import type { Context } from '@truckermudgeon/map/routing';
import { findRoute } from '@truckermudgeon/map/routing';

interface Options {
  startNodeUid: bigint;
  endNodeUid: bigint;
  routeContext: Context;
}
export default function (routeOptions: Options) {
  const { startNodeUid, endNodeUid, routeContext } = routeOptions;
  return findRoute(
    startNodeUid,
    endNodeUid,
    'forward',
    'shortest',
    routeContext,
  );
}
