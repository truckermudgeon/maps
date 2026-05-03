import { throttle } from '@truckermudgeon/base/throttle';
import { action, makeAutoObservable } from 'mobx';
import type { Breakpoints, UIEnvironmentStore } from './types';

export class UiEnvironmentStoreImpl implements UIEnvironmentStore {
  readonly breakpoints: Breakpoints;
  _width = window.innerWidth;
  _height = window.innerHeight;

  constructor(breakpoints: Breakpoints) {
    this.breakpoints = breakpoints;
    makeAutoObservable(this, { handleResize: false });
    window.addEventListener('resize', this.handleResize);
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get isLargePortrait(): boolean {
    return this.width >= this.breakpoints.sm && this.orientation === 'portrait';
  }

  get orientation(): 'portrait' | 'landscape' {
    return this.width > this.height ? 'landscape' : 'portrait';
  }

  handleResize = action(
    throttle(() => {
      this._width = window.innerWidth;
      this._height = window.innerHeight;
    }, 100),
  );
}
