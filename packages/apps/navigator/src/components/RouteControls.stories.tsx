import type { Meta, StoryObj } from '@storybook/react';

import { RouteControls } from './RouteControls';

const meta = {
  component: RouteControls,
} satisfies Meta<typeof RouteControls>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    summary: {
      minutes: 123,
      distanceMeters: 4000,
    },
    expanded: false,
  },
};

export const Expanded: Story = {
  args: {
    summary: {
      minutes: 123,
      distanceMeters: 4000,
    },
    expanded: true,
  },
};
