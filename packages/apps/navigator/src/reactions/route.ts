import type { IReactionDisposer } from 'mobx';
import { reaction } from 'mobx';
import type { MapPresenter } from '../services/map-presenter';
import type { NavSheetStore, RouteStore } from '../stores/types';
import { sortedRoutePreviewIndices } from '../util/route-display';

export interface RouteReactionDeps {
  route: RouteStore;
  mapPresenter: MapPresenter;
  navSheetStore: NavSheetStore;
}

/**
 * Reactions that mutate map sources/layers in response to route-related
 * store changes — preview rendering for the routes list, the active
 * step's arrow when no nav sheet is showing.
 */
export function wireRouteReactions(
  deps: RouteReactionDeps,
): IReactionDisposer[] {
  const { route, mapPresenter, navSheetStore } = deps;
  const disposers: IReactionDisposer[] = [];

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
            mapPresenter.renderRoutePreview(routes[routeIndex], {
              index: layerIndex,
              highlight: selected?.id === routes[routeIndex]?.id,
              animate: prev.routes !== routes,
            }),
        );
        if (routes.length === 0 && !selected) {
          // assume a navsheet reset happened. restore active route.
          mapPresenter.renderActiveRoute(route.activeRoute);
        }
      },
    ),
  );

  disposers.push(
    reaction(
      () => (navSheetStore.showNavSheet ? undefined : route.activeArrowStep),
      step => mapPresenter.drawStepArrow(step),
    ),
  );

  return disposers;
}
