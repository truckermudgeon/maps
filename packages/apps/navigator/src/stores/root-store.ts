import type { MapPaddingStore, UIEnvironmentStore } from '../controllers/types';
import type { CameraStoreImpl } from './camera';
import type { RouteStoreImpl } from './route';
import type { SessionStoreImpl } from './session';
import type { NavSheetStore } from './types';

/**
 * Composition root: bundles the focused stores into a single object
 * that the React tree consumes via `RootStoreProvider`.
 *
 * New components should access stores via the per-domain hooks
 * (`useRouteStore`, `useCameraStore`, etc.) rather than through this
 * object directly.
 */
export class RootStore {
  readonly session: SessionStoreImpl;
  readonly camera: CameraStoreImpl;
  readonly route: RouteStoreImpl;
  readonly navSheet: NavSheetStore;
  readonly uiEnv: UIEnvironmentStore;
  readonly mapPadding: MapPaddingStore;

  constructor(opts: {
    session: SessionStoreImpl;
    camera: CameraStoreImpl;
    route: RouteStoreImpl;
    navSheet: NavSheetStore;
    uiEnv: UIEnvironmentStore;
    mapPadding: MapPaddingStore;
  }) {
    this.session = opts.session;
    this.camera = opts.camera;
    this.route = opts.route;
    this.navSheet = opts.navSheet;
    this.uiEnv = opts.uiEnv;
    this.mapPadding = opts.mapPadding;
  }
}
