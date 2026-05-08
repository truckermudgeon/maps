import { computed, makeAutoObservable } from 'mobx';
import { BearingMode } from './camera';
import type {
  CameraStore,
  MapPaddingStore,
  NavSheetStore,
  RouteStore,
  UIEnvironmentStore,
} from './types';

const directionBannerBottom = 120;
const routeStackBottom = 90;
const verticalPadding = 40;

export class MapPaddingStoreImpl implements MapPaddingStore {
  constructor(
    private readonly uiEnvStore: UIEnvironmentStore,
    private readonly route: RouteStore,
    private readonly camera: CameraStore,
    private readonly navStore: NavSheetStore,
  ) {
    makeAutoObservable(this, {
      padding: computed.struct,
      offset: computed.struct,
    });
  }

  get padding(): {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  } {
    const showingPartialHeightNavSheet =
      this.navStore.showNavSheet &&
      this.navStore.currentPageRequiresMapVisibility;

    return {
      left:
        (this.navStore.showNavSheet || this.route.activeRoute) &&
        this.navSheetWidth !== this.uiEnvStore.width
          ? this.navSheetWidth
          : 0,
      right: 0,
      top: this.route.activeRoute ? directionBannerBottom : 0,
      bottom: showingPartialHeightNavSheet
        ? Math.round(this.uiEnvStore.height * 0.4)
        : this.route.activeRoute
          ? routeStackBottom
          : 0,
    };
  }

  get navSheetWidth(): number {
    // see NavSheetContainer parent in create-app.tsx
    //// TODO define these in some constants file
    const numGridCols =
      this.uiEnvStore.width <= this.uiEnvStore.breakpoints.sm
        ? 12
        : this.uiEnvStore.isLargePortrait
          ? 12
          : 5;
    const maxWidth = this.uiEnvStore.isLargePortrait
      ? this.uiEnvStore.width
      : 600;
    return Math.min(
      maxWidth,
      Math.floor((this.uiEnvStore.width / 12) * numGridCols),
    );
  }

  //of the target center relative to real map container center at the end of animation.
  get offset(): [number, number] {
    if (this.camera.bearingMode === BearingMode.NORTH_LOCK) {
      // no need to offset in north-lock mode: map should be centered on player.
      return [0, 0];
    }

    // offset map so that player marker is toward the bottom of the screen,
    // above the route stack (if visible).
    const markerHeight = 50;
    const bottomControlsHeight =
      this.uiEnvStore.orientation === 'portrait' &&
      this.navStore.showNavSheet &&
      this.navStore.currentPageRequiresMapVisibility
        ? this.uiEnvStore.height * 0.4
        : this.uiEnvStore.orientation === 'portrait' && this.route.activeRoute
          ? routeStackBottom
          : 0;
    const padding = this.route.activeRoute
      ? markerHeight + verticalPadding
      : markerHeight + verticalPadding / 2;
    const offsetY = this.uiEnvStore.height / 2 - bottomControlsHeight - padding;
    return [0, offsetY];
  }
}
