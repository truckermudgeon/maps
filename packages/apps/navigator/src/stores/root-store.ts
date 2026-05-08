import type {
  CameraStore,
  ControlsStore,
  MapPaddingStore,
  NavSheetStore,
  RouteStore,
  SessionStore,
  UIEnvironmentStore,
} from './types';

/**
 * Composition root: bundles the focused stores into a single object
 * that the React tree consumes via `RootStoreProvider`.
 *
 * New components should access stores via the per-domain hooks
 * (`useRouteStore`, `useCameraStore`, etc.) rather than through this
 * object directly.
 */
export class RootStore {
  readonly session: SessionStore;
  readonly camera: CameraStore;
  readonly route: RouteStore;
  readonly navSheet: NavSheetStore;
  readonly controls: ControlsStore;
  readonly uiEnv: UIEnvironmentStore;
  readonly mapPadding: MapPaddingStore;

  constructor(opts: {
    session: SessionStore;
    camera: CameraStore;
    route: RouteStore;
    navSheet: NavSheetStore;
    controls: ControlsStore;
    uiEnv: UIEnvironmentStore;
    mapPadding: MapPaddingStore;
  }) {
    this.session = opts.session;
    this.camera = opts.camera;
    this.route = opts.route;
    this.navSheet = opts.navSheet;
    this.controls = opts.controls;
    this.uiEnv = opts.uiEnv;
    this.mapPadding = opts.mapPadding;
  }
}
