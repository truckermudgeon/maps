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

export const Spinner: Story = {
  args: {
    bindingStale: false,
    onRePair: fn(),
  },
};

export const StalePrompt: Story = {
  args: {
    bindingStale: true,
    onRePair: fn(),
  },
};
