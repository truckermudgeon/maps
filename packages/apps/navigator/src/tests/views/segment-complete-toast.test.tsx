import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SegmentInfo } from '@truckermudgeon/navigation/types';
import { runInAction } from 'mobx';
import { vi } from 'vitest';
import { RouteStoreImpl } from '../../stores/route';
import { SegmentCompleteToast } from '../../views/SegmentCompleteToast';
import { renderWithStores } from '../util/render-with-stores';

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

describe('SegmentCompleteToast (view)', () => {
  it('renders nothing when route.segmentComplete is undefined', () => {
    const { container } = renderWithStores(
      <SegmentCompleteToast onContinue={vi.fn()} onEnd={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders place + placeInfo when segmentComplete is set', () => {
    renderWithStores(
      <SegmentCompleteToast onContinue={vi.fn()} onEnd={vi.fn()} />,
      {
        stores: { route: makeRouteWithSegment(segmentArrived) },
      },
    );

    expect(screen.getByText('You have arrived')).toBeInTheDocument();
    expect(screen.getByText(/Sacramento/)).toBeInTheDocument();
    expect(screen.getByText('CA')).toBeInTheDocument();
  });

  it.each([
    {
      name: 'Continue → onContinue',
      buttonName: /continue/i,
      callbackKey: 'onContinue' as const,
      otherCallbackKey: 'onEnd' as const,
    },
    {
      name: 'End Trip → onEnd',
      buttonName: /end trip/i,
      callbackKey: 'onEnd' as const,
      otherCallbackKey: 'onContinue' as const,
    },
  ])(
    '$name fires the prop callback exactly once',
    async ({ buttonName, callbackKey, otherCallbackKey }) => {
      const callbacks = { onContinue: vi.fn(), onEnd: vi.fn() };
      const user = userEvent.setup();
      renderWithStores(<SegmentCompleteToast {...callbacks} />, {
        stores: { route: makeRouteWithSegment(segmentArrived) },
      });

      await user.click(screen.getByRole('button', { name: buttonName }));

      expect(callbacks[callbackKey]).toHaveBeenCalledTimes(1);
      expect(callbacks[otherCallbackKey]).not.toHaveBeenCalled();
    },
  );

  it('hides the Continue button on the final segment', () => {
    renderWithStores(
      <SegmentCompleteToast onContinue={vi.fn()} onEnd={vi.fn()} />,
      {
        stores: {
          route: makeRouteWithSegment({ ...segmentArrived, isFinal: true }),
        },
      },
    );

    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /end trip/i }),
    ).toBeInTheDocument();
  });
});
