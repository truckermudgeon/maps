import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { RouteControls } from './RouteControls';
import { toLengthAndUnit } from './text';

const meta = {
  title: 'Route/RouteControls',
  component: RouteControls,
} satisfies Meta<typeof RouteControls>;

export default meta;

type Story = StoryObj<typeof meta>;

const requiredEventHandlers = {
  onExpandedToggle: fn(),
  onSearchAlongRouteClick: fn(),
  onRoutePreviewClick: fn(),
  onRouteDirectionsClick: fn(),
  onRouteEndClick: fn(),
};

const { length, unit } = toLengthAndUnit(4000);

export const Default: Story = {
  args: {
    summary: {
      minutes: 123,
      distance: { length, unit },
    },
    ...requiredEventHandlers,
  },
};

export const WithManageStops: Story = {
  args: {
    ...Default.args,
    onManageStopsClick: fn(),
  },
};
