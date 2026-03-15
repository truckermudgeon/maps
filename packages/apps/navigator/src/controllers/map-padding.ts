import { computed, makeAutoObservable } from 'mobx';
import type {
  AppStore,
  MapPaddingStore,
  NavSheetStore,
  UIEnvironmentStore,
} from './types';

const directionBannerBottom = 120;
const routeStackBottom = 90;

export class MapPaddingStoreImpl implements MapPaddingStore {
  constructor(
    private readonly uiEnvStore: UIEnvironmentStore,
    private readonly appStore: AppStore,
    private readonly navStore: NavSheetStore,
  ) {
    makeAutoObservable(this, {
      padding: computed.struct,
    });
  }

  get padding(): {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  } {
    return {
      left:
        this.appStore.showNavSheet &&
        this.navSheetWidth !== this.uiEnvStore.width
          ? this.navSheetWidth
          : 0,
      right: 0,
      top: this.appStore.activeRoute ? directionBannerBottom : 0,
      bottom: this.appStore.activeRoute ? routeStackBottom : 0,
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
    const maxWidth = this.uiEnvStore.isLargePortrait ? Infinity : 600;
    console.log(this.uiEnvStore.breakpoints);
    console.log('numGridCols', numGridCols);
    console.log('maxWidth', maxWidth);
    console.log('envWidth', this.uiEnvStore.width);
    return Math.min(
      maxWidth,
      this.uiEnvStore.width,
      Math.floor((this.uiEnvStore.width / 12) * numGridCols),
    );
  }

  //of the target center relative to real map container center at the end of animation.
  get offset(): [number, number] {
    //const mapCenterY = this.uiEnvStore.height / 2;
    return [0, -100];
  }
}
