import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { ChooseOnMapPage } from './ChooseOnMapPage';

const meta = {
  title: 'Search/ChooseOnMapPage',
  component: ChooseOnMapPage,
} satisfies Meta<typeof ChooseOnMapPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onUseThisPointClick: fn(),
  },
};
