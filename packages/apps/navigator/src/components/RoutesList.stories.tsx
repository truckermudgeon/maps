import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Default as RouteDefault } from './RouteItem.stories';
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
      ...RouteDefault.args.route,
      id: `route-${i}`,
    })),
    onRouteGoClick: fn(),
    onRouteHighlight: fn(),
  },
};
