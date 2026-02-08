import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import {
  Default as RouteDefault,
  WithSummary as RouteWithSummary,
} from './RouteItem.stories';
import { RoutesList } from './RoutesList';

const meta = {
  title: 'Search/Route List',
  component: RoutesList,
} satisfies Meta<typeof RoutesList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    routes: Array.from({ length: 3 }, (_, i) => ({
      ...(i % 2 === 1 ? RouteDefault.args.route : RouteWithSummary.args.route),
      id: `route-${i}`,
    })).concat([
      {
        ...RouteWithSummary.args.route,
        summary: { grades: [], roads: [], hasTolls: true },
      },
    ]),
    onRouteDetailsClick: fn(),
    onRouteGoClick: fn(),
    onRouteHighlight: fn(),
  },
};
