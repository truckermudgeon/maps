import type { IReactionDisposer } from 'mobx';
import type { MapPresenter } from '../services/map-presenter';
import type {
  CameraStore,
  MapPaddingStore,
  NavSheetStore,
  RouteStore,
} from '../stores/types';
import { wireCameraReactions } from './camera';
import { wireRouteReactions } from './route';

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
