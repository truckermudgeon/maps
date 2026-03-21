import type { Meta, StoryObj } from '@storybook/react';
import { Compass } from './Compass';

const meta = {
  title: 'HUD/Compass',
  component: Compass,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Compass>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoLetter: Story = {
  args: {
    direction: 'NW',
  },
  render: (args, context) => (
    <Compass {...args} mode={context.globals['theme'] as 'light' | 'dark'} />
  ),
};

export const OneLetter: Story = {
  ...TwoLetter,
  args: {
    direction: 'W',
  },
};
