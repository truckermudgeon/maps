import type { IReactionDisposer } from 'mobx';
import { action, autorun, reaction } from 'mobx';
import type { AppControllerImpl } from '../controllers/app';
import { CameraMode, NavPageKey } from '../controllers/constants';
import type { MapPaddingStore } from '../controllers/types';
import { routeCornerPair, routesCornerPairs } from '../route-bounds';
import type { CameraStore, NavSheetStore, RouteStore } from '../stores/types';

export interface CameraReactionDeps {
  camera: CameraStore;
  route: RouteStore;
  controller: AppControllerImpl;
  navSheetStore: NavSheetStore;
  mapPaddingStore: MapPaddingStore;
}

/**
 * Reactions that move or reshape the map camera in response to store
 * changes — padding/offset, choose-on-map mode, and the various
 * fit-to-bounds events that fire during navsheet flows.
 */
export function wireCameraReactions(
  deps: CameraReactionDeps,
): IReactionDisposer[] {
  const { camera, route, controller, navSheetStore, mapPaddingStore } = deps;
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
        navSheetStore.showNavSheet &&
        navSheetStore.currentPageKey === NavPageKey.CHOOSE_ON_MAP,
      action(isChoosingOnMap => {
        controller.toggleChooseOnMapUi(isChoosingOnMap);
        if (isChoosingOnMap) {
          controller.clearPitchAndBearing();
          camera.cameraMode = CameraMode.FREE;
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
          controller.setFree();
          if (!navSheetStore.disableFitToBounds) {
            controller.fitPoints(maybeLonLats);
          }
        }
      }),
    ),
  );

  disposers.push(
    reaction(
      () => {
        if (
          navSheetStore.showNavSheet &&
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
        if (maybeRoutes.every(r => r.detour)) {
          const tlbrs = [route.truckPoint, maybeRoutes[0].detour!.lngLat];
          console.log('tlbrs', tlbrs);
          camera.cameraMode = CameraMode.FREE;
          controller.fitPoints(tlbrs as [number, number][]);
        } else {
          const tlbrs = routesCornerPairs(maybeRoutes);
          console.log('tlbrs', tlbrs);
          camera.cameraMode = CameraMode.FREE;
          controller.fitPoints(tlbrs);
        }
      },
    ),
  );

  disposers.push(
    reaction(
      () =>
        navSheetStore.showNavSheet &&
        navSheetStore.currentPageKey === NavPageKey.MANAGE_STOPS
          ? route.activeRoute
          : undefined,
      maybeRoute => {
        if (!maybeRoute) {
          return;
        }
        camera.cameraMode = CameraMode.FREE;
        controller.fitPoints(routeCornerPair(maybeRoute));
      },
    ),
  );

  return disposers;
}
