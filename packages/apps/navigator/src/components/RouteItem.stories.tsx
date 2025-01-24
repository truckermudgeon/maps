import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { RouteItem } from './RouteItem';

const meta = {
  title: 'Search/Route Item',
  component: RouteItem,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof RouteItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    route: {
      id: '',
      segments: [
        {
          key: 'key',
          lonLats: [],
          distance: 0,
          time: 0,
          strategy: 'shortest',
        },
      ],
    },
    onRouteHighlight: fn(),
    onRouteGoClick: fn(),
  },
};
