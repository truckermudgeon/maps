/* eslint-disable @typescript-eslint/unbound-method */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BearingMode, CameraMode } from '../../controllers/constants';
import { CameraStoreImpl } from '../../stores/camera';
import { ControlsStoreImpl } from '../../stores/controls';
import { NavSheetStoreImpl } from '../../stores/nav-sheet';
import { RouteStoreImpl } from '../../stores/route';
import { SessionStoreImpl } from '../../stores/session';
import { requestWakeLock } from '../../util/browser';
import { Controls } from '../Controls';
import { renderWithApp } from './_helpers/render-with-app';

vi.mock('../../util/browser', () => ({
  requestWakeLock: vi.fn(),
  clearCredentialsAndReload: vi.fn(),
}));

interface Stores {
  session: SessionStoreImpl;
  camera: CameraStoreImpl;
  route: RouteStoreImpl;
  navSheet: NavSheetStoreImpl;
  controls: ControlsStoreImpl;
}

function setup(): Stores {
  const session = new SessionStoreImpl('usa');
  const camera = new CameraStoreImpl();
  const route = new RouteStoreImpl();
  const navSheet = new NavSheetStoreImpl();
  const controls = new ControlsStoreImpl(session, camera, route, navSheet);
  return { session, camera, route, navSheet, controls };
}

function clickByIconTestId(
  user: ReturnType<typeof userEvent.setup>,
  testId: string,
) {
  const icon = screen.getByTestId(testId);
  const button = icon.closest('button');
  if (!button) {
    throw new Error(`no button ancestor for ${testId}`);
  }
  return user.click(button);
}

describe('Controls (view)', () => {
  beforeEach(() => {
    vi.mocked(requestWakeLock).mockClear();
  });

  it.each([
    {
      name: 'MATCH_MAP → setNorthLock',
      mode: BearingMode.MATCH_MAP,
      expectedMethod: 'setNorthLock' as const,
    },
    {
      name: 'NORTH_LOCK → setNorthUnlock',
      mode: BearingMode.NORTH_LOCK,
      expectedMethod: 'setNorthUnlock' as const,
    },
  ])(
    'compass click: $name + requests wake lock',
    async ({ mode, expectedMethod }) => {
      const stores = setup();
      stores.camera.bearingMode = mode;
      const setNorthLock = vi.spyOn(stores.camera, 'setNorthLock');
      const setNorthUnlock = vi.spyOn(stores.camera, 'setNorthUnlock');
      const user = userEvent.setup();
      renderWithApp(<Controls />, { stores });

      await user.click(screen.getByText(/^[NESW]+$/));

      const fired =
        expectedMethod === 'setNorthLock' ? setNorthLock : setNorthUnlock;
      const other =
        expectedMethod === 'setNorthLock' ? setNorthUnlock : setNorthLock;
      expect(fired).toHaveBeenCalledTimes(1);
      expect(other).not.toHaveBeenCalled();
      expect(requestWakeLock).toHaveBeenCalledTimes(1);
    },
  );

  it('recenter fab: requests wake lock + setFollow (only visible in FREE camera)', async () => {
    const stores = setup();
    stores.camera.cameraMode = CameraMode.FREE;
    const setFollow = vi.spyOn(stores.camera, 'setFollow');
    const user = userEvent.setup();
    renderWithApp(<Controls />, { stores });

    await clickByIconTestId(user, 'NavigationOutlinedIcon');

    expect(requestWakeLock).toHaveBeenCalledTimes(1);
    expect(setFollow).toHaveBeenCalledTimes(1);
  });

  it('route fab: starts choose-destination flow + requests wake lock', async () => {
    const stores = setup();
    stores.navSheet.startChooseDestinationFlow = vi.fn();
    const user = userEvent.setup();
    renderWithApp(<Controls />, { stores });

    await clickByIconTestId(user, 'DirectionsIcon');

    expect(requestWakeLock).toHaveBeenCalledTimes(1);
    expect(stores.navSheet.startChooseDestinationFlow).toHaveBeenCalledTimes(1);
  });

  it('search fab: starts search-along flow + requests wake lock (only with active route)', async () => {
    const stores = setup();
    stores.route.activeRoute = { id: 'r' } as never;
    stores.navSheet.startSearchAlongFlow = vi.fn();
    const user = userEvent.setup();
    renderWithApp(<Controls />, { stores });

    await clickByIconTestId(user, 'SearchIcon');

    expect(requestWakeLock).toHaveBeenCalledTimes(1);
    expect(stores.navSheet.startSearchAlongFlow).toHaveBeenCalledTimes(1);
  });
});
