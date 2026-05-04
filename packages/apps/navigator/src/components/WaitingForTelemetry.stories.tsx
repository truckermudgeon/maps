import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { WaitingForTelemetry } from './WaitingForTelemetry';

const meta = {
  title: 'Session/WaitingForTelemetry',
  component: WaitingForTelemetry,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof WaitingForTelemetry>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Awaiting: Story = {
  args: {
    state: 'awaiting',
    onRePair: fn(),
  },
};

export const Orphaned: Story = {
  args: {
    state: 'orphaned',
    onRePair: fn(),
  },
};

export const Lost: Story = {
  args: {
    state: 'lost',
    onRePair: fn(),
  },
};
