/* eslint-disable @typescript-eslint/unbound-method */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SegmentInfo } from '@truckermudgeon/navigation/types';
import { runInAction } from 'mobx';
import { vi } from 'vitest';
import type { AppController } from '../../controllers/types';
import { RouteStoreImpl } from '../../stores/route';
import { SegmentCompleteToast } from '../SegmentCompleteToast';
import { renderWithApp } from './_helpers/render-with-app';

const segmentArrived: SegmentInfo = {
  place: 'Sacramento',
  placeInfo: 'CA',
  isFinal: false,
};

function makeRouteWithSegment(
  segment: SegmentInfo | undefined,
): RouteStoreImpl {
  const route = new RouteStoreImpl();
  runInAction(() => {
    route.segmentComplete = segment;
  });
  return route;
}

function makeFakeController(): AppController {
  return {
    unpauseRouteEvents: vi.fn(),
    setActiveRoute: vi.fn(),
  } as unknown as AppController;
}

describe('SegmentCompleteToast (view)', () => {
  it('renders nothing when route.segmentComplete is undefined', () => {
    const { container } = renderWithApp(<SegmentCompleteToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders place + placeInfo when segmentComplete is set', () => {
    renderWithApp(<SegmentCompleteToast />, {
      stores: { route: makeRouteWithSegment(segmentArrived) },
    });

    expect(screen.getByText('You have arrived')).toBeInTheDocument();
    expect(screen.getByText(/Sacramento/)).toBeInTheDocument();
    expect(screen.getByText('CA')).toBeInTheDocument();
  });

  it('Continue → controller.unpauseRouteEvents (only)', async () => {
    const controller = makeFakeController();
    const user = userEvent.setup();
    renderWithApp(<SegmentCompleteToast />, {
      stores: { route: makeRouteWithSegment(segmentArrived) },
      services: { controller },
    });

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(controller.unpauseRouteEvents).toHaveBeenCalledTimes(1);
    expect(controller.setActiveRoute).not.toHaveBeenCalled();
  });

  it('End Trip → unpauseRouteEvents + setActiveRoute(undefined)', async () => {
    const controller = makeFakeController();
    const user = userEvent.setup();
    renderWithApp(<SegmentCompleteToast />, {
      stores: { route: makeRouteWithSegment(segmentArrived) },
      services: { controller },
    });

    await user.click(screen.getByRole('button', { name: /end trip/i }));

    expect(controller.unpauseRouteEvents).toHaveBeenCalledTimes(1);
    expect(controller.setActiveRoute).toHaveBeenCalledTimes(1);
    expect(controller.setActiveRoute).toHaveBeenCalledWith(undefined);
  });

  it('hides the Continue button on the final segment', () => {
    renderWithApp(<SegmentCompleteToast />, {
      stores: {
        route: makeRouteWithSegment({ ...segmentArrived, isFinal: true }),
      },
    });

    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /end trip/i }),
    ).toBeInTheDocument();
  });
});
