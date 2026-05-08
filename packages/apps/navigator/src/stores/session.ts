import { makeAutoObservable } from 'mobx';
import type { SessionStore, TelemetryStatus } from './types';

export class SessionStoreImpl implements SessionStore {
  themeMode: 'light' | 'dark' = 'light';
  hasReceivedFirstTelemetry = false;
  isAuthenticated = false;
  bindingStale = false;

  constructor(public map: 'usa' | 'europe') {
    makeAutoObservable(this);
  }

  get telemetryStatus(): TelemetryStatus {
    if (!this.hasReceivedFirstTelemetry) {
      return this.bindingStale ? 'orphaned' : 'awaiting';
    }
    return this.bindingStale ? 'lost' : 'live';
  }
}
