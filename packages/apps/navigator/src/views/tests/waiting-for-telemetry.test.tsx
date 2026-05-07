/* eslint-disable @typescript-eslint/unbound-method */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runInAction } from 'mobx';
import { vi } from 'vitest';
import type { AppController } from '../../controllers/types';
import { SessionStoreImpl } from '../../stores/session';
import { WaitingForTelemetry } from '../WaitingForTelemetry';
import { renderWithApp } from './render-with-app';

function makeOrphanedSession(): SessionStoreImpl {
  const session = new SessionStoreImpl('usa');
  runInAction(() => {
    session.isAuthenticated = true;
    session.bindingStale = true; // orphaned: ready+stale, no first telemetry
  });
  return session;
}

describe('WaitingForTelemetry (view)', () => {
  it('"Enter pairing code" → controller.forceRePair', async () => {
    const controller = {
      forceRePair: vi.fn(),
    } as unknown as AppController;
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
