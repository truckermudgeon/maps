import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { TelemetryLostToast } from './TelemetryLostToast';

const meta = {
  title: 'Session/TelemetryLostToast',
  component: TelemetryLostToast,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TelemetryLostToast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    open: true,
    onRePair: fn(),
  },
};

export const Closed: Story = {
  args: {
    open: false,
    onRePair: fn(),
  },
};
