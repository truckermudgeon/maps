import type { Meta, StoryObj } from '@storybook/react';
import { memo } from 'react';
import type { AppClient } from '../controllers/types';

import { SessionGate } from './SessionGate';

const meta = {
  component: SessionGate,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SessionGate>;

export default meta;

type Story = StoryObj<typeof meta>;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const appClient: Pick<AppClient, 'redeemCode' | 'reconnect'> = {
  reconnect: {
    mutate: async () => {
      await delay(4000);
      return true;
    },
  },
  redeemCode: {
    mutate: async () => {
      await delay(4000);
      return {
        viewerId: 'a-b-c-d-e',
        telemetryId: 'a',
      };
    },
  },
};

export const Default: Story = {
  args: {
    appClient,
    readyToLoadStore: { readyToLoad: true },
    App: memo(() => <div>Done.</div>),
  },
  loaders: [
    () => {
      console.log('clearing viewerId in localStorage');
      localStorage.removeItem('viewerId');
    },
  ],
};

const loadingAppClient: Pick<AppClient, 'redeemCode' | 'reconnect'> = {
  ...appClient,
  reconnect: {
    // show code input after delay
    mutate: async () => {
      await delay(5_000);
      return false;
    },
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    appClient: loadingAppClient,
  },
  loaders: [
    () => {
      console.log('setting viewerId in localStorage');
      localStorage.setItem('viewerId', 'storybookViewerId');
    },
  ],
};

const redeemErrorAppClient = {
  ...appClient,
  redeemCode: {
    mutate: async () => {
      await delay(4000);
      throw new Error('Invalid code');
    },
  },
};

export const ErrorOnRedeem: Story = {
  args: {
    ...Default.args,
    appClient: redeemErrorAppClient,
  },
  loaders: [
    () => {
      console.log('clearing viewerId in localStorage');
      localStorage.removeItem('viewerId');
    },
  ],
};
