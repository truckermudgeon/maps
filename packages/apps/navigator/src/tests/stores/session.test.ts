import { runInAction } from 'mobx';
import { describe, expect, it } from 'vitest';
import { SessionStoreImpl } from '../../stores/session';

describe('SessionStoreImpl', () => {
  it('seeds map from constructor argument', () => {
    expect(new SessionStoreImpl('usa').map).toBe('usa');
    expect(new SessionStoreImpl('europe').map).toBe('europe');
  });

  it('defaults flags to a fresh-session state', () => {
    const s = new SessionStoreImpl('usa');
    expect(s.themeMode).toBe('light');
    expect(s.hasReceivedFirstTelemetry).toBe(false);
    expect(s.readyToLoad).toBe(false);
    expect(s.bindingStale).toBe(false);
  });

  it('exposes mutable fields', () => {
    const s = new SessionStoreImpl('usa');
    runInAction(() => {
      s.themeMode = 'dark';
      s.hasReceivedFirstTelemetry = true;
      s.readyToLoad = true;
      s.bindingStale = true;
      s.map = 'europe';
    });
    expect(s.themeMode).toBe('dark');
    expect(s.hasReceivedFirstTelemetry).toBe(true);
    expect(s.readyToLoad).toBe(true);
    expect(s.bindingStale).toBe(true);
    expect(s.map).toBe('europe');
  });
});
