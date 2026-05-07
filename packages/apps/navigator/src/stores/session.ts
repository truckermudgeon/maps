import { makeAutoObservable } from 'mobx';
import type { SessionStore } from './types';

export class SessionStoreImpl implements SessionStore {
  themeMode: 'light' | 'dark' = 'light';
  hasReceivedFirstTelemetry = false;
  isAuthenticated = false;
  bindingStale = false;

  constructor(public map: 'usa' | 'europe') {
    makeAutoObservable(this);
  }
}
