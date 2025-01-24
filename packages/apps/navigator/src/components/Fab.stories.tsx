import { Search } from '@mui/icons-material';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Fab } from './Fab';

const meta = {
  title: 'HUD/Fab',
  component: Fab,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Fab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Solid: Story = {
  args: {
    show: true,
    onClick: fn(),
    Icon: () => <Search />,
  },
};

export const Plain: Story = {
  args: {
    show: true,
    variant: 'plain',
    backgroundColor: 'background.body',
    onClick: fn(),
    Icon: () => <Search />,
  },
};
