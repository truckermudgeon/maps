import type { IReactionDisposer } from 'mobx';
import { action, autorun, reaction } from 'mobx';
import { CameraMode, NavPageKey } from '../controllers/constants';
import type { MapPresenter } from '../services/map-presenter';
import type {
  CameraStore,
  MapPaddingStore,
  NavSheetStore,
  RouteStore,
} from '../stores/types';
import { routeCornerPair, routesCornerPairs } from '../util/route-bounds';

export interface CameraReactionDeps {
  camera: CameraStore;
  route: RouteStore;
  mapPresenter: MapPresenter;
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
  const { camera, route, mapPresenter, navSheetStore, mapPaddingStore } = deps;
  const disposers: IReactionDisposer[] = [];

  disposers.push(
    autorun(() => {
      mapPresenter.setOffset(mapPaddingStore.offset);
      mapPresenter.setPadding(mapPaddingStore.padding);
    }),
  );

  disposers.push(
    reaction(
      () =>
        navSheetStore.showNavSheet &&
        navSheetStore.currentPageKey === NavPageKey.CHOOSE_ON_MAP,
      action(isChoosingOnMap => {
        mapPresenter.toggleChooseOnMapUi(isChoosingOnMap);
        if (isChoosingOnMap) {
          mapPresenter.clearPitchAndBearing();
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
          camera.setFree();
          if (!navSheetStore.disableFitToBounds) {
            mapPresenter.fitPoints(maybeLonLats);
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
          mapPresenter.fitPoints(tlbrs as [number, number][]);
        } else {
          const tlbrs = routesCornerPairs(maybeRoutes);
          console.log('tlbrs', tlbrs);
          camera.cameraMode = CameraMode.FREE;
          mapPresenter.fitPoints(tlbrs);
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
        mapPresenter.fitPoints(routeCornerPair(maybeRoute));
      },
    ),
  );

  return disposers;
}
