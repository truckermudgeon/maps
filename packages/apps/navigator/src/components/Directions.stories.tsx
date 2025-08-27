import type { Meta, StoryObj } from '@storybook/react';
import { BranchType } from '@truckermudgeon/navigation/constants';
import { Directions } from './Directions';

const meta = {
  title: 'Route/Directions',
  component: Directions,
} satisfies Meta<typeof Directions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    direction: BranchType.RIGHT,
    distanceMeters: 40,
  },
};

export const WithNameText: Story = {
  args: {
    ...Default.args,
    distanceMeters: Default.args.distanceMeters * 10,
    name: {
      text: 'Main St',
    },
  },
};

export const WithLaneHint: Story = {
  args: {
    ...Default.args,
    distanceMeters: Default.args.distanceMeters * 10,
    laneHint: {
      lanes: [
        {
          branches: [BranchType.LEFT],
        },
        {
          branches: [BranchType.THROUGH],
        },
        {
          branches: [BranchType.THROUGH, BranchType.RIGHT],
          activeBranch: BranchType.RIGHT,
        },
        {
          branches: [BranchType.RIGHT],
          activeBranch: BranchType.RIGHT,
        },
      ],
    },
  },
};

export const WithThenHint: Story = {
  args: {
    ...Default.args,
    distanceMeters: Default.args.distanceMeters * 1000,
    thenHint: {
      direction: BranchType.SLIGHT_LEFT,
    },
  },
};

export const WithLaneAndThenHints: Story = {
  args: {
    ...WithLaneHint.args,
    ...WithThenHint.args,
    distanceMeters: Default.args.distanceMeters * 10000,
  },
};
