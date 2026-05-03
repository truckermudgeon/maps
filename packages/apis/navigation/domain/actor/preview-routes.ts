import { assertExists } from '@truckermudgeon/base/assert';
import type {
  RouteIndex,
  RouteWithSummary,
  TruckSimTelemetry,
} from '../../types';
import type { DomainEventSink } from '../events';
import type { GraphAndMapData, GraphMappedData } from '../lookup-data';
import type { RouteWithLookup, RoutingService } from './generate-routes';
import { addWaypoint, generateRoutes } from './generate-routes';
import { generateSummary } from './generate-summary';

export async function computePreviewRoutes(
  toNodeUid: bigint,
  session: {
    activeRoute: RouteWithLookup | undefined;
    routeIndex: RouteIndex | undefined;
    truck: TruckSimTelemetry['truck'];
  },
  deps: {
    graphAndMapData: GraphAndMapData<GraphMappedData>;
    routing: RoutingService;
    domainEventSink: DomainEventSink;
  },
): Promise<RouteWithSummary[]> {
  const { activeRoute, routeIndex, truck } = session;
  const { graphAndMapData, routing, domainEventSink } = deps;

  const routesWithLookup: RouteWithLookup[] = [];
  if (!activeRoute) {
    routesWithLookup.push(
      ...(await generateRoutes(
        toNodeUid,
        ['smallRoads', 'shortest', 'fastest'],
        { graphAndMapData, routing, truck, domainEventSink },
      )),
    );
  } else {
    routesWithLookup.push(
      await addWaypoint(toNodeUid, activeRoute, 'auto', {
        graphAndMapData,
        routing,
        routeIndex: assertExists(
          routeIndex,
          'routeIndex required when active route is set',
        ),
        truck,
        domainEventSink,
      }),
    );
  }

  const routes = routesWithLookup.map(rwl => {
    const { lookup, ...route } = rwl;
    return {
      ...route,
      summary: generateSummary(rwl, graphAndMapData),
    };
  });

  const uniqueRoutes = new Map<string, RouteWithSummary>(
    routes.map(route => {
      const key = route.segments
        .flatMap(s => s.steps.flatMap(step => step.geometry))
        .join();
      return [key, route];
    }),
  );
  return [...uniqueRoutes.values()].reverse();
}
