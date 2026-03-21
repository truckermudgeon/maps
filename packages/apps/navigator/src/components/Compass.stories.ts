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
};

export const OneLetter: Story = {
  args: {
    direction: 'W',
  },
};
