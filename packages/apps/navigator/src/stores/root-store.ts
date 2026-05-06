import type { AppStoreImpl } from '../controllers/app';
import type { MapPaddingStore, UIEnvironmentStore } from '../controllers/types';
import type { NavSheetStore } from './types';

/**
 * Composition root: bundles the focused stores plus the legacy
 * `appStore` facade that older consumers still reach for.
 *
 * New components should access stores via the per-domain hooks
 * (`useRouteStore`, `useCameraStore`, etc.) rather than through this
 * object directly.
 */
export class RootStore {
  readonly appStore: AppStoreImpl;
  readonly session: AppStoreImpl['session'];
  readonly camera: AppStoreImpl['camera'];
  readonly route: AppStoreImpl['route'];
  readonly navSheet: NavSheetStore;
  readonly uiEnv: UIEnvironmentStore;
  readonly mapPadding: MapPaddingStore;

  constructor(opts: {
    appStore: AppStoreImpl;
    navSheet: NavSheetStore;
    uiEnv: UIEnvironmentStore;
    mapPadding: MapPaddingStore;
  }) {
    this.appStore = opts.appStore;
    this.session = opts.appStore.session;
    this.camera = opts.appStore.camera;
    this.route = opts.appStore.route;
    this.navSheet = opts.navSheet;
    this.uiEnv = opts.uiEnv;
    this.mapPadding = opts.mapPadding;
  }
}
