import type { Meta, StoryObj } from '@storybook/react';
import { BranchType } from '@truckermudgeon/navigation/constants';
import * as React from 'react';

import { LaneIcon } from './LaneIcon';

const meta = {
  title: 'Route/Lane Icon',
  component: LaneIcon,
  decorators: [
    (Story: () => React.JSX.Element) => (
      <div style={{ width: 64 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof LaneIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {
  args: {
    branches: [BranchType.THROUGH, BranchType.LEFT],
  },
};

export const Active: Story = {
  args: {
    branches: [BranchType.THROUGH, BranchType.LEFT],
    activeBranch: BranchType.LEFT,
  },
};

export const Merge: Story = {
  args: {
    branches: [BranchType.MERGE],
    activeBranch: BranchType.MERGE,
  },
};
