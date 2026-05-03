import { BranchType } from '@truckermudgeon/navigation/constants';
import type { StepManeuver } from '@truckermudgeon/navigation/types';

export const exampleLaneHint: NonNullable<StepManeuver['laneHint']> = {
  lanes: [
    { branches: [BranchType.LEFT] },
    { branches: [BranchType.THROUGH] },
    {
      branches: [BranchType.THROUGH, BranchType.RIGHT],
      activeBranch: BranchType.RIGHT,
    },
    { branches: [BranchType.RIGHT], activeBranch: BranchType.RIGHT },
  ],
};
