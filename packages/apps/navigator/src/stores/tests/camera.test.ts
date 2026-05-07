import { describe, expect, it } from 'vitest';
import { BearingMode, CameraMode } from '../../controllers/constants';
import { CameraStoreImpl } from '../camera';

describe('CameraStoreImpl', () => {
  it('defaults to FOLLOW + MATCH_MAP', () => {
    const c = new CameraStoreImpl();
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
    const c = new CameraStoreImpl();
    setup?.(c);
    action(c);
    expect(c[field]).toBe(expected);
  });
});
