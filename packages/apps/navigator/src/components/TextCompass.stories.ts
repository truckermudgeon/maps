import type { Meta, StoryObj } from '@storybook/react';
import { TextCompass } from './TextCompass';

const meta = {
  title: 'HUD/Text Compass',
  component: TextCompass,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TextCompass>;

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
