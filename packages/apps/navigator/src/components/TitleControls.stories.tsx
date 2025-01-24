import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { TitleControls } from './TitleControls';

const meta = {
  title: 'Search/Title',
  component: TitleControls,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TitleControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    showBackButton: true,
    title: 'Page Title',
    onBackClick: fn(),
    onCloseClick: fn(),
  },
};

export const WithoutBackButton: Story = {
  args: {
    showBackButton: false,
    title: 'Page Title',
    onBackClick: fn(),
    onCloseClick: fn(),
  },
};
