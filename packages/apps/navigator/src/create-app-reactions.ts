import type { IReactionDisposer } from 'mobx';
import { action, autorun, reaction } from 'mobx';
import type { AppControllerImpl } from './controllers/app';
import { CameraMode, NavPageKey } from './controllers/constants';
import type {
  AppStore,
  MapPaddingStore,
  NavSheetStore,
} from './controllers/types';
import { routeCornerPair, routesCornerPairs } from './route-bounds';
import { sortedRoutePreviewIndices } from './route-display';

export interface ReactionDeps {
  store: AppStore;
  controller: AppControllerImpl;
  navSheetStore: NavSheetStore;
  mapPaddingStore: MapPaddingStore;
}

export function wireAppReactions(deps: ReactionDeps): IReactionDisposer[] {
  const { store, controller, navSheetStore, mapPaddingStore } = deps;
  const disposers: IReactionDisposer[] = [];

  disposers.push(
    autorun(() => {
      controller.setOffset(mapPaddingStore.offset);
      controller.setPadding(mapPaddingStore.padding);
    }),
  );

  disposers.push(
    reaction(
      () =>
        store.showNavSheet &&
        navSheetStore.currentPageKey === NavPageKey.CHOOSE_ON_MAP,
      action(isChoosingOnMap => {
        controller.toggleChooseOnMapUi(store, isChoosingOnMap);
        if (isChoosingOnMap) {
          controller.clearPitchAndBearing(store);
          store.cameraMode = CameraMode.FREE;
        }
      }),
    ),
  );

  disposers.push(
    reaction(
      () => {
        if (
          navSheetStore.destinations.length === 0 ||
          navSheetStore.currentPageKey !== NavPageKey.DESTINATIONS
        ) {
          return undefined;
        }
        return navSheetStore.destinations.map(
          destination => destination.lonLat,
        );
      },
      action(maybeLonLats => {
        if (maybeLonLats) {
          controller.setFree(store);
          if (!navSheetStore.disableFitToBounds) {
            controller.fitPoints(store, maybeLonLats);
          }
        }
      }),
    ),
  );

  disposers.push(
    reaction(
      () => {
        if (
          store.showNavSheet &&
          navSheetStore.currentPageKey === NavPageKey.ROUTES &&
          !navSheetStore.isLoading
        ) {
          return navSheetStore.routes;
        } else {
          return undefined;
        }
      },
      maybeRoutes => {
        if (!maybeRoutes) {
          return;
        }
        if (maybeRoutes.every(route => route.detour)) {
          const tlbrs = [store.truckPoint, maybeRoutes[0].detour!.lngLat];
          console.log('tlbrs', tlbrs);
          store.cameraMode = CameraMode.FREE;
          controller.fitPoints(store, tlbrs as [number, number][]);
        } else {
          const tlbrs = routesCornerPairs(maybeRoutes);
          console.log('tlbrs', tlbrs);
          store.cameraMode = CameraMode.FREE;
          controller.fitPoints(store, tlbrs);
        }
      },
    ),
  );

  // render calls can be made directly by nav sheet controller.
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
      () =>
        store.showNavSheet &&
        navSheetStore.currentPageKey === NavPageKey.MANAGE_STOPS
          ? store.activeRoute
          : undefined,
      maybeRoute => {
        if (!maybeRoute) {
          return;
        }
        store.cameraMode = CameraMode.FREE;
        controller.fitPoints(store, routeCornerPair(maybeRoute));
      },
    ),
  );

  disposers.push(
    reaction(
      () => (store.showNavSheet ? undefined : store.activeArrowStep),
      step => controller.drawStepArrow(step),
    ),
  );

  return disposers;
}
