import type { IReactionDisposer } from 'mobx';
import { reaction } from 'mobx';
import type { AppControllerImpl } from '../controllers/app';
import type { AppStore, NavSheetStore } from '../controllers/types';
import { sortedRoutePreviewIndices } from '../route-display';

export interface RouteReactionDeps {
  store: AppStore;
  controller: AppControllerImpl;
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
  const { store, controller, navSheetStore } = deps;
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
            controller.renderRoutePreview(routes[routeIndex], {
              index: layerIndex,
              highlight: selected?.id === routes[routeIndex]?.id,
              animate: prev.routes !== routes,
            }),
        );
        if (routes.length === 0 && !selected) {
          // assume a navsheet reset happened. restore active route.
          controller.renderActiveRoute(store.activeRoute);
        }
      },
    ),
  );

  disposers.push(
    reaction(
      () => (navSheetStore.showNavSheet ? undefined : store.activeArrowStep),
      step => controller.drawStepArrow(step),
    ),
  );

  return disposers;
}
