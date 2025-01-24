import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { DestinationTypes } from './DestinationTypes';

const meta = {
  title: 'Search/Destination Types',
  component: DestinationTypes,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof DestinationTypes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    onClick: fn(),
  },
};
