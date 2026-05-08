import { describe, expect, it } from 'vitest';
import { BearingMode, CameraMode, CameraStoreImpl } from '../camera';
import { NavPageKey, NavSheetStoreImpl } from '../nav-sheet';

const makeCamera = () => new CameraStoreImpl(new NavSheetStoreImpl());

describe('CameraStoreImpl', () => {
  it('defaults to FOLLOW + MATCH_MAP', () => {
    const c = makeCamera();
    expect(c.cameraMode).toBe(CameraMode.FOLLOW);
    expect(c.bearingMode).toBe(BearingMode.MATCH_MAP);
  });

  it.each([
    {
      name: 'setFree → FREE',
      action: (c: CameraStoreImpl) => c.setFree(),
      field: 'cameraMode' as const,
      expected: CameraMode.FREE,
    },
    {
      name: 'setFollow → FOLLOW',
      setup: (c: CameraStoreImpl) => c.setFree(),
      action: (c: CameraStoreImpl) => c.setFollow(),
      field: 'cameraMode' as const,
      expected: CameraMode.FOLLOW,
    },
    {
      name: 'setNorthLock → NORTH_LOCK',
      action: (c: CameraStoreImpl) => c.setNorthLock(),
      field: 'bearingMode' as const,
      expected: BearingMode.NORTH_LOCK,
    },
    {
      name: 'setNorthUnlock → MATCH_MAP',
      setup: (c: CameraStoreImpl) => c.setNorthLock(),
      action: (c: CameraStoreImpl) => c.setNorthUnlock(),
      field: 'bearingMode' as const,
      expected: BearingMode.MATCH_MAP,
    },
  ])('$name', ({ setup, action, field, expected }) => {
    const c = makeCamera();
    setup?.(c);
    action(c);
    expect(c[field]).toBe(expected);
  });

  describe('cameraMode derivation', () => {
    it.each([
      {
        name: 'default (no detach, no forcing page) → FOLLOW',
        expected: CameraMode.FOLLOW,
      },
      {
        name: 'userDetached → FREE',
        arrange: (c: CameraStoreImpl) => c.setFree(),
        expected: CameraMode.FREE,
      },
      {
        name: 'navSheet on forcing page → FREE',
        arrange: (_c: CameraStoreImpl, n: NavSheetStoreImpl) => {
          n.showNavSheet = true;
          n.pushPage(NavPageKey.ROUTES);
        },
        expected: CameraMode.FREE,
      },
      {
        name: 'forcing page without showNavSheet → FOLLOW',
        arrange: (_c: CameraStoreImpl, n: NavSheetStoreImpl) =>
          n.pushPage(NavPageKey.ROUTES),
        expected: CameraMode.FOLLOW,
      },
      {
        name: 'setFollow clears userDetached → FOLLOW',
        arrange: (c: CameraStoreImpl) => {
          c.setFree();
          c.setFollow();
        },
        expected: CameraMode.FOLLOW,
      },
      {
        name: 'forcing page beats setFollow',
        arrange: (c: CameraStoreImpl, n: NavSheetStoreImpl) => {
          n.showNavSheet = true;
          n.pushPage(NavPageKey.ROUTES);
          c.setFollow();
        },
        expected: CameraMode.FREE,
      },
      {
        name: 'leaving forcing page reverts when not detached',
        arrange: (_c: CameraStoreImpl, n: NavSheetStoreImpl) => {
          n.showNavSheet = true;
          n.pushPage(NavPageKey.ROUTES);
          n.popPage();
        },
        expected: CameraMode.FOLLOW,
      },
    ])('$name', ({ arrange, expected }) => {
      const navSheet = new NavSheetStoreImpl();
      const c = new CameraStoreImpl(navSheet);
      arrange?.(c, navSheet);
      expect(c.cameraMode).toBe(expected);
    });
  });
});
