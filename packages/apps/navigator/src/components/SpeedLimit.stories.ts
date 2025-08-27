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

export const MPHWith0Speed: Story = {
  args: {
    limitMph: 50,
    speedMph: 0,
  },
};

export const MPHWithNormalSpeed: Story = {
  args: {
    limitMph: 50,
    speedMph: 50 * 0.95,
  },
};

export const MPHWithFastSpeed: Story = {
  args: {
    limitMph: 50,
    speedMph: 50 * 1.1,
  },
};

export const MPHWithLudicrousSpeed: Story = {
  args: {
    limitMph: 50,
    speedMph: 50 * 1.2,
  },
};

export const KPH: Story = {
  args: {
    limitKph: 50,
    speedMph: 0,
  },
};
