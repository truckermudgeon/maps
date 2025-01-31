import type { Meta, StoryObj } from '@storybook/react';
import { SpeedLimit } from './SpeedLimit';

const meta = {
  title: 'HUD/Speed Limit',
  component: SpeedLimit,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SpeedLimit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MPH: Story = {
  args: {
    limitMph: 50,
  },
};

export const KPH: Story = {
  args: {
    limitKph: 50,
  },
};
