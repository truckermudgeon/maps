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

export const Primary: Story = {
  args: {
    limitMph: 50,
  },
};
