import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { WithLaneHint } from './Directions.stories';

import { Directions } from './Directions';
import { RouteStack } from './RouteStack';

const meta = {
  title: 'Route/RouteStack',
  component: RouteStack,
  decorators: [
    (Story: () => React.JSX.Element) => (
      <div style={{ backgroundColor: '#f888', maxWidth: 600, height: '90vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RouteStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    Guidance: () => <Directions {...WithLaneHint.args} />,
    onRouteEndClick: fn(),
  },
};
