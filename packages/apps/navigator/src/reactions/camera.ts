import type { IReactionDisposer } from 'mobx';
import { action, autorun, reaction } from 'mobx';
import type { MapCamera, MapMarkers } from '../services/map';
import { NavPageKey } from '../stores/nav-sheet';
import type {
  MapPaddingStore,
  NavSheetStore,
  RouteStore,
} from '../stores/types';
import { routeCornerPair, routesCornerPairs } from '../util/route-bounds';

export interface CameraReactionDeps {
  route: RouteStore;
  mapCamera: MapCamera;
  mapMarkers: MapMarkers;
  navSheetStore: NavSheetStore;
  mapPaddingStore: MapPaddingStore;
}

/**
 * Reactions that move or reshape the map camera in response to store
 * changes — padding/offset, choose-on-map mode, and the various
 * fit-to-bounds events that fire during navsheet flows. Camera mode
 * itself is now derived (CameraStore.cameraMode is a computed of
 * userDetached + NavSheetStore.requiresFreeCamera), so these reactions
 * only invoke imperative map-side effects.
 */
export function wireCameraReactions(
  deps: CameraReactionDeps,
): IReactionDisposer[] {
  const { route, mapCamera, mapMarkers, navSheetStore, mapPaddingStore } = deps;
  const disposers: IReactionDisposer[] = [];

  disposers.push(
    autorun(() => {
      mapCamera.setOffset(mapPaddingStore.offset);
      mapCamera.setPadding(mapPaddingStore.padding);
    }),
  );

  disposers.push(
    reaction(
      () =>
        navSheetStore.showNavSheet &&
        navSheetStore.currentPageKey === NavPageKey.CHOOSE_ON_MAP,
      action(isChoosingOnMap => {
        mapMarkers.toggleChooseOnMapMarker(isChoosingOnMap);
        if (isChoosingOnMap) {
          mapCamera.clearPitchAndBearing();
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
      maybeLonLats => {
        if (maybeLonLats && !navSheetStore.disableFitToBounds) {
          mapCamera.fitPoints(maybeLonLats);
        }
      },
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
          mapCamera.fitPoints(tlbrs as [number, number][]);
        } else {
          mapCamera.fitPoints(routesCornerPairs(maybeRoutes));
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
        mapCamera.fitPoints(routeCornerPair(maybeRoute));
      },
    ),
  );

  return disposers;
}
