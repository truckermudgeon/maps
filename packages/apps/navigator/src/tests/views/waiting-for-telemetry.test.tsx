/* eslint-disable @typescript-eslint/unbound-method */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runInAction } from 'mobx';
import { vi } from 'vitest';
import type { AppControllerImpl } from '../../controllers/app';
import { SessionStoreImpl } from '../../stores/session';
import { WaitingForTelemetry } from '../../views/WaitingForTelemetry';
import { renderWithApp } from '../util/render-with-app';

function makeOrphanedSession(): SessionStoreImpl {
  const session = new SessionStoreImpl('usa');
  runInAction(() => {
    session.readyToLoad = true;
    session.bindingStale = true; // orphaned: ready+stale, no first telemetry
  });
  return session;
}

describe('WaitingForTelemetry (view)', () => {
  it('"Enter pairing code" → controller.forceRePair', async () => {
    const controller = {
      forceRePair: vi.fn(),
    } as unknown as AppControllerImpl;
    const user = userEvent.setup();
    renderWithApp(<WaitingForTelemetry />, {
      stores: { session: makeOrphanedSession() },
      services: { controller },
    });

    await user.click(
      screen.getByRole('button', { name: /enter pairing code/i }),
    );

    expect(controller.forceRePair).toHaveBeenCalledTimes(1);
  });
});
