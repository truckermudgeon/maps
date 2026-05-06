import type { IReactionDisposer } from 'mobx';
import type { AppControllerImpl } from './controllers/app';
import type {
  AppStore,
  MapPaddingStore,
  NavSheetStore,
} from './controllers/types';
import { wireCameraReactions } from './reactions/camera';
import { wireRouteReactions } from './reactions/route';

export interface ReactionDeps {
  store: AppStore;
  controller: AppControllerImpl;
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
