import type { Meta, StoryObj } from '@storybook/react';
import { WithLaneHint } from './Directions.stories';

import { Directions } from './Directions';
import { RouteStack } from './RouteStack';

const meta = {
  component: RouteStack,
} satisfies Meta<typeof RouteStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    Guidance: () => <Directions {...WithLaneHint.args} />,
  },
};
