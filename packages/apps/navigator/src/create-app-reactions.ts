import type { IReactionDisposer } from 'mobx';
import type { MapPaddingStore } from './controllers/types';
import { wireCameraReactions } from './reactions/camera';
import { wireRouteReactions } from './reactions/route';
import type { MapPresenter } from './services/map-presenter';
import type { CameraStore, NavSheetStore, RouteStore } from './stores/types';

export interface ReactionDeps {
  camera: CameraStore;
  route: RouteStore;
  mapPresenter: MapPresenter;
  navSheetStore: NavSheetStore;
  mapPaddingStore: MapPaddingStore;
}

/**
 * Composes the per-domain reaction wirings into a single call site
 * that create-app.tsx invokes. Each per-domain function lives under
 * `reactions/`.
 */
export function wireAppReactions(deps: ReactionDeps): IReactionDisposer[] {
  return [...wireCameraReactions(deps), ...wireRouteReactions(deps)];
}
