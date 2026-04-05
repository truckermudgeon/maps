import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
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
    bearing: -45,
    onClick: fn(),
  },
  render: (args, context) => (
    <Compass {...args} mode={context.globals['theme'] as 'light' | 'dark'} />
  ),
};

export const OneLetter: Story = {
  ...TwoLetter,
  args: {
    ...TwoLetter.args,
    bearing: -90,
  },
};
