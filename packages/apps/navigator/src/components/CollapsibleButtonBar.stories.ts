import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { CollapsibleButtonBar } from './CollapsibleButtonBar';

const meta = {
  title: 'Search/Collapsible Route Buttons',
  component: CollapsibleButtonBar,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof CollapsibleButtonBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {
  args: {
    visible: true,
    onDestinationRoutesClick: fn(),
    onDestinationGoClick: fn(),
  },
};

export const Hidden: Story = {
  args: {
    visible: false,
    onDestinationRoutesClick: fn(),
    onDestinationGoClick: fn(),
  },
};
