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
          key: '0-0-forward-fastest',
          steps: [],
          distanceMeters: 0,
          duration: 0,
          strategy: 'shortest',
          score: 0,
        },
      ],
      distanceMeters: 0,
      duration: 0,
      summary: {
        grades: [],
        roads: [],
        hasTolls: false,
      },
    },
    onRouteHighlight: fn(),
    onRouteDetailsClick: fn(),
    onRouteGoClick: fn(),
  },
};

export const WithDetour: Story = {
  args: {
    ...Default.args,
    route: {
      ...Default.args.route,
      detour: {
        distanceMeters: 1234,
        duration: 1234,
        lngLat: [0, 0],
      },
    },
  },
};

export const WithSummary: Story = {
  args: {
    ...Default.args,
    route: {
      ...Default.args.route,
      summary: {
        grades: [
          {
            flatIndexStart: 0,
            flatIndexEnd: 0,
            percentage: 6,
            distance: 500,
            range: 1,
          },
          {
            flatIndexStart: 0,
            flatIndexEnd: 0,
            percentage: -9,
            distance: 5_000,
            range: 1,
          },
        ],
        roads: ['us101', 'is80', 'ca_r14', 'us93alt', 'txl323'],
        hasTolls: true,
      },
    },
  },
};
