import type { Meta, StoryObj } from '@storybook/react';
import { BranchType } from '@truckermudgeon/navigation/constants';
import type { PropsWithChildren } from 'react';
import { LaneIcon } from './LaneIcon';

const meta = {
  title: 'Route/Lane Icon',
  component: LaneIconCombinations,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof LaneIconCombinations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Combinations: Story = {
  args: {
    maxTypes: 3,
    size: 48,
  },
};

interface Props {
  maxTypes?: number;
  size?: number;
}

function LaneIconCombinations(props: Props) {
  const { maxTypes = 3, size = 48 } = props;
  const elems = [];
  const branchTypes = [
    BranchType.THROUGH,
    BranchType.SLIGHT_LEFT,
    BranchType.LEFT,
    BranchType.SHARP_LEFT,
    BranchType.U_TURN_LEFT,
    BranchType.SLIGHT_RIGHT,
    BranchType.RIGHT,
    BranchType.SHARP_RIGHT,
    BranchType.U_TURN_RIGHT,
  ];
  for (let i = 1; i <= maxTypes; i++) {
    for (const sets of choose(branchTypes, i)) {
      if (
        (sets.includes(BranchType.U_TURN_LEFT) &&
          sets.includes(BranchType.SHARP_LEFT)) ||
        (sets.includes(BranchType.U_TURN_RIGHT) &&
          sets.includes(BranchType.SHARP_RIGHT))
      ) {
        continue;
      }
      for (const activeBranch of sets) {
        elems.push(
          <Div key={i + '.' + activeBranch + '.' + sets.join()} size={size}>
            <LaneIcon branches={sets} activeBranch={activeBranch} />
          </Div>,
        );
      }
    }
  }
  elems.push(
    <Div key={'merge'} size={size}>
      <LaneIcon branches={[BranchType.MERGE]} />
    </Div>,
  );

  return <div style={{ fontSize: 0 }}>{elems}</div>;
}

function Div(props: PropsWithChildren<{ size: number }>) {
  const { size, children } = props;
  return (
    <div
      style={{
        display: 'inline-block',
        position: 'relative',
        width: size,
        height: size,
        border: '1px solid',
      }}
    >
      {children}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: 'calc(50% - 0.5px)',
          borderRight: '1px dashed #88888833',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 'calc(50% - 0.5px)',
          borderBottom: '1px dashed #88888833',
        }}
      />
    </div>
  );
}

function choose<T>(arr: T[], k: number, prefix: T[] = []): T[][] {
  if (k == 0) {
    return [prefix];
  }
  return arr.flatMap((v, i) => choose(arr.slice(i + 1), k - 1, [...prefix, v]));
}
