import { runInAction } from 'mobx';
import { describe, expect, it } from 'vitest';
import { SessionStoreImpl } from '../../stores/session';
import type { TelemetryStatus } from '../../stores/types';

describe('SessionStoreImpl', () => {
  it('seeds map from constructor argument', () => {
    expect(new SessionStoreImpl('usa').map).toBe('usa');
    expect(new SessionStoreImpl('europe').map).toBe('europe');
  });

  it('defaults flags to a fresh-session state', () => {
    const s = new SessionStoreImpl('usa');
    expect(s.themeMode).toBe('light');
    expect(s.hasReceivedFirstTelemetry).toBe(false);
    expect(s.isAuthenticated).toBe(false);
    expect(s.bindingStale).toBe(false);
  });

  it('exposes mutable fields', () => {
    const s = new SessionStoreImpl('usa');
    runInAction(() => {
      s.themeMode = 'dark';
      s.hasReceivedFirstTelemetry = true;
      s.isAuthenticated = true;
      s.bindingStale = true;
      s.map = 'europe';
    });
    expect(s.themeMode).toBe('dark');
    expect(s.hasReceivedFirstTelemetry).toBe(true);
    expect(s.isAuthenticated).toBe(true);
    expect(s.bindingStale).toBe(true);
    expect(s.map).toBe('europe');
  });

  it.each<{
    first: boolean;
    stale: boolean;
    expected: TelemetryStatus;
  }>([
    { first: false, stale: false, expected: 'awaiting' },
    { first: false, stale: true, expected: 'orphaned' },
    { first: true, stale: false, expected: 'live' },
    { first: true, stale: true, expected: 'lost' },
  ])(
    'telemetryStatus: first=$first stale=$stale → $expected',
    ({ first, stale, expected }) => {
      const s = new SessionStoreImpl('usa');
      runInAction(() => {
        s.hasReceivedFirstTelemetry = first;
        s.bindingStale = stale;
      });
      expect(s.telemetryStatus).toBe(expected);
    },
  );
});
