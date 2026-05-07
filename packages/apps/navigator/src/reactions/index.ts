import type { IReactionDisposer } from 'mobx';
import type { ChooseOnMapService } from '../services/choose-on-map';
import type { MapAdapter } from '../services/map-adapter';
import type { RouteRenderer } from '../services/route-renderer';
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
  mapAdapter: MapAdapter;
  chooseOnMapService: ChooseOnMapService;
  routeRenderer: RouteRenderer;
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
