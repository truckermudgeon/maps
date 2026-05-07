/* eslint-disable @typescript-eslint/unbound-method */
import polyline from '@mapbox/polyline';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Route } from '@truckermudgeon/navigation/types';
import { runInAction } from 'mobx';
import { vi } from 'vitest';
import type { AppControllerImpl } from '../../controllers/app';
import { CameraMode } from '../../controllers/constants';
import { CameraStoreImpl } from '../../stores/camera';
import { NavSheetStoreImpl } from '../../stores/nav-sheet';
import { RouteStoreImpl } from '../../stores/route';
import { RouteControls } from '../../views/RouteControls';
import { renderWithApp } from '../util/render-with-app';

function makeRouteWithSegments(segmentCount: number): Route {
  const segment = {
    key: 'a-b',
    steps: [
      {
        geometry: polyline.encode([
          [0, 0],
          [1, 1],
        ]),
        trafficIcons: [],
      },
    ],
  };
  return {
    id: 'r1',
    segments: Array.from({ length: segmentCount }, () => segment),
  } as unknown as Route;
}

function makeRouteStoreWith(activeRoute: Route | undefined): RouteStoreImpl {
  const route = new RouteStoreImpl();
  runInAction(() => {
    route.activeRoute = activeRoute;
  });
  return route;
}

describe('RouteControls (view)', () => {
  async function expand(user: ReturnType<typeof userEvent.setup>) {
    // The action buttons live inside a <Collapse> that opens via the
    // disclosure IconButton (the only IconButton on this card).
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
  }

  it('Manage Stops → navSheet.startManageStopsFlow (visible when 2+ segments)', async () => {
    const navSheet = new NavSheetStoreImpl();
    navSheet.startManageStopsFlow = vi.fn();
    const user = userEvent.setup();
    renderWithApp(<RouteControls onExpandedToggle={vi.fn()} />, {
      stores: { route: makeRouteStoreWith(makeRouteWithSegments(2)), navSheet },
    });

    await expand(user);
    await user.click(screen.getByRole('button', { name: /manage stops/i }));

    expect(navSheet.startManageStopsFlow).toHaveBeenCalledTimes(1);
  });

  it('Manage Stops is hidden for single-segment routes', async () => {
    const user = userEvent.setup();
    renderWithApp(<RouteControls onExpandedToggle={vi.fn()} />, {
      stores: { route: makeRouteStoreWith(makeRouteWithSegments(1)) },
    });

    await expand(user);

    expect(
      screen.queryByRole('button', { name: /manage stops/i }),
    ).not.toBeInTheDocument();
  });

  it('Preview route → no-op + warns when there is no active route', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const camera = new CameraStoreImpl();
    const mapAdapter = { fitPoints: vi.fn(), flyTo: vi.fn() };
    const user = userEvent.setup();
    renderWithApp(<RouteControls onExpandedToggle={vi.fn()} />, {
      stores: { camera, route: makeRouteStoreWith(undefined) },
      services: { mapAdapter: mapAdapter as never },
    });

    await expand(user);
    await user.click(screen.getByRole('button', { name: /preview route/i }));

    expect(warn).toHaveBeenCalled();
    expect(mapAdapter.fitPoints).not.toHaveBeenCalled();
    expect(camera.cameraMode).toBe(CameraMode.FOLLOW); // unchanged from default
    warn.mockRestore();
  });

  it('Preview route → sets free camera + fits points to active route', async () => {
    const camera = new CameraStoreImpl();
    const mapAdapter = { fitPoints: vi.fn(), flyTo: vi.fn() };
    const user = userEvent.setup();
    renderWithApp(<RouteControls onExpandedToggle={vi.fn()} />, {
      stores: {
        camera,
        route: makeRouteStoreWith(makeRouteWithSegments(1)),
      },
      services: { mapAdapter: mapAdapter as never },
    });

    await expand(user);
    await user.click(screen.getByRole('button', { name: /preview route/i }));

    expect(camera.cameraMode).toBe(CameraMode.FREE);
    expect(mapAdapter.fitPoints).toHaveBeenCalledTimes(1);
  });

  it('End Route → controller.setActiveRoute(undefined)', async () => {
    const controller = {
      setActiveRoute: vi.fn(),
    } as unknown as AppControllerImpl;
    const user = userEvent.setup();
    renderWithApp(<RouteControls onExpandedToggle={vi.fn()} />, {
      stores: { route: makeRouteStoreWith(makeRouteWithSegments(1)) },
      services: { controller },
    });

    await expand(user);
    await user.click(screen.getByRole('button', { name: /end route/i }));

    expect(controller.setActiveRoute).toHaveBeenCalledTimes(1);
    expect(controller.setActiveRoute).toHaveBeenCalledWith(undefined);
  });
});
