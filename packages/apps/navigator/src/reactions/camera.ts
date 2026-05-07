import type { IReactionDisposer } from 'mobx';
import { action, autorun, reaction } from 'mobx';
import type { ChooseOnMapService } from '../services/choose-on-map';
import type { MapAdapter } from '../services/map-adapter';
import { CameraMode } from '../stores/camera';
import { NavPageKey } from '../stores/nav-sheet';
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
  mapAdapter: MapAdapter;
  chooseOnMapService: ChooseOnMapService;
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
  const {
    camera,
    route,
    mapAdapter,
    chooseOnMapService,
    navSheetStore,
    mapPaddingStore,
  } = deps;
  const disposers: IReactionDisposer[] = [];

  disposers.push(
    autorun(() => {
      mapAdapter.setOffset(mapPaddingStore.offset);
      mapAdapter.setPadding(mapPaddingStore.padding);
    }),
  );

  disposers.push(
    reaction(
      () =>
        navSheetStore.showNavSheet &&
        navSheetStore.currentPageKey === NavPageKey.CHOOSE_ON_MAP,
      action(isChoosingOnMap => {
        chooseOnMapService.toggle(isChoosingOnMap);
        if (isChoosingOnMap) {
          mapAdapter.clearPitchAndBearing();
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
            mapAdapter.fitPoints(maybeLonLats);
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
          mapAdapter.fitPoints(tlbrs as [number, number][]);
        } else {
          const tlbrs = routesCornerPairs(maybeRoutes);
          console.log('tlbrs', tlbrs);
          camera.cameraMode = CameraMode.FREE;
          mapAdapter.fitPoints(tlbrs);
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
        mapAdapter.fitPoints(routeCornerPair(maybeRoute));
      },
    ),
  );

  return disposers;
}
