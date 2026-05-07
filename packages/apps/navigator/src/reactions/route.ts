import type { IReactionDisposer } from 'mobx';
import { reaction } from 'mobx';
import type { MapHandle } from '../services/map';
import type { RouteRenderer } from '../services/route-renderer';
import type { NavSheetStore, RouteStore } from '../stores/types';
import { sortedRoutePreviewIndices } from '../util/route-display';

export interface RouteReactionDeps {
  route: RouteStore;
  routeRenderer: RouteRenderer;
  navSheetStore: NavSheetStore;
  mapHandle: MapHandle;
}

/**
 * Reactions that mutate map sources/layers in response to route-related
 * store changes — preview rendering for the routes list, the active
 * step's arrow when no nav sheet is showing.
 */
export function wireRouteReactions(
  deps: RouteReactionDeps,
): IReactionDisposer[] {
  const { route, routeRenderer, navSheetStore, mapHandle } = deps;
  const disposers: IReactionDisposer[] = [];

  // Renders the active route geometry whenever it changes — and replays
  // it once the map loads, in case routeUpdate arrived first (page
  // reload race: WS reconnects faster than MapGl's onLoad fires).
  disposers.push(
    reaction(
      () => (mapHandle.isMapLoaded ? route.activeRoute : undefined),
      activeRoute => routeRenderer.renderActiveRoute(activeRoute),
      { fireImmediately: true },
    ),
  );

  // Render calls can also be made directly by the nav sheet controller;
  // this reaction handles the case where the routes list changes shape
  // (or empties) and the layer order needs to update.
  disposers.push(
    reaction(
      () => ({
        routes: navSheetStore.routes,
        selected: navSheetStore.selectedRoute,
      }),
      ({ routes, selected }, prev) => {
        sortedRoutePreviewIndices(routes, selected).forEach(
          (routeIndex, layerIndex) =>
            routeRenderer.renderRoutePreview(routes[routeIndex], {
              index: layerIndex,
              highlight: selected?.id === routes[routeIndex]?.id,
              animate: prev.routes !== routes,
            }),
        );
        if (routes.length === 0 && !selected) {
          // assume a navsheet reset happened. restore active route.
          routeRenderer.renderActiveRoute(route.activeRoute);
        }
      },
    ),
  );

  disposers.push(
    reaction(
      () => (navSheetStore.showNavSheet ? undefined : route.activeArrowStep),
      step => routeRenderer.drawStepArrow(step),
    ),
  );

  return disposers;
}
