import type { Meta, StoryObj } from '@storybook/react';
import { BranchType } from '@truckermudgeon/navigation/constants';
import { Directions } from './Directions';
import { defaultImperialOptions, toLengthAndUnit } from './text';

const meta = {
  title: 'Route/Directions',
  component: Directions,
} satisfies Meta<typeof Directions>;

export default meta;
type Story = StoryObj<typeof meta>;

let { length, unit } = toLengthAndUnit(40, defaultImperialOptions);
export const Default: Story = {
  args: {
    direction: BranchType.RIGHT,
    length,
    unit,
  },
};

({ length, unit } = toLengthAndUnit(40 * 10, defaultImperialOptions));
export const WithNameText: Story = {
  args: {
    ...Default.args,
    length,
    unit,
    banner: {
      text: 'Main St',
    },
  },
};

({ length, unit } = toLengthAndUnit(40 * 10, defaultImperialOptions));
export const WithLaneHint: Story = {
  args: {
    ...Default.args,
    length,
    unit,
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

({ length, unit } = toLengthAndUnit(40 * 1000, defaultImperialOptions));
export const WithThenHint: Story = {
  args: {
    ...Default.args,
    length,
    unit,
    thenHint: {
      direction: BranchType.SLIGHT_LEFT,
    },
  },
};

({ length, unit } = toLengthAndUnit(40 * 10_000, defaultImperialOptions));
export const WithLaneAndThenHints: Story = {
  args: {
    ...WithLaneHint.args,
    ...WithThenHint.args,
    length,
    unit,
  },
};
