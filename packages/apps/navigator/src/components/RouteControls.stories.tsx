import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { RouteControls } from './RouteControls';

const meta = {
  title: 'Route/RouteControls',
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
    onDisclosureClick: fn(),
    onRouteEndClick: fn(),
  },
};

export const Expanded: Story = {
  args: {
    summary: {
      minutes: 123,
      distanceMeters: 4000,
    },
    expanded: true,
    onDisclosureClick: fn(),
    onRouteEndClick: fn(),
  },
};
