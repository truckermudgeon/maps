import type { Meta, StoryObj } from '@storybook/react';
import { BranchType } from '@truckermudgeon/navigation/constants';
import type { PropsWithChildren } from 'react';
import { LaneIcon } from './LaneIcon';

const meta = {
  title: 'Route/Lane Icon',
  component: LaneIconCombinations,
  parameters: {},
} satisfies Meta<typeof LaneIconCombinations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Roundabouts: Story = {
  args: {
    size: 48,
  },
};

interface Props {
  size?: number;
}

function LaneIconCombinations(props: Props) {
  const { size = 48 } = props;
  const elems = [];
  const branchTypes = [
    BranchType.ROUND_BR,
    BranchType.ROUND_R,
    BranchType.ROUND_TR,
    BranchType.ROUND_T,
    BranchType.ROUND_TL,
    BranchType.ROUND_L,
    BranchType.ROUND_BL,
    BranchType.ROUND_B,
    BranchType.ROUND_EXIT,
  ];
  for (const activeBranch of branchTypes) {
    elems.push(
      <Div key={activeBranch} size={size}>
        <LaneIcon branches={[activeBranch]} activeBranch={activeBranch} />
      </Div>,
    );
  }

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
