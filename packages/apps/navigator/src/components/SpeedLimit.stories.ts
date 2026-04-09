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
    units: 'imperial',
    limit: 50,
    speed: 0,
  },
};

export const MPHWithNormalSpeed: Story = {
  args: {
    ...MPH.args,
    speed: MPH.args.limit * 0.95,
  },
};

export const MPHWithFastSpeed: Story = {
  args: {
    ...MPH.args,
    speed: MPH.args.limit * 1.1,
  },
};

export const MPHWithLudicrousSpeed: Story = {
  args: {
    ...MPH.args,
    speed: MPH.args.limit * 1.2,
  },
};

export const KPH: Story = {
  args: {
    units: 'metric',
    limit: 80,
    speed: 0,
  },
};

export const KPHWithNormalSpeed: Story = {
  args: {
    ...KPH.args,
    speed: KPH.args.limit * 0.8,
  },
};
