import type { Meta, StoryObj } from '@storybook/react';
import { BranchType } from '@truckermudgeon/navigation/constants';
import type { StepManeuver } from '@truckermudgeon/navigation/types';
import { useEffect, useState } from 'react';
import { AnimatedDirections } from './AnimatedDirections';
import { exampleLaneHint } from './Directions.fixtures';

const meta = {
  title: 'Route/AnimatedDirections',
  component: AnimatedDirections,
} satisfies Meta<typeof AnimatedDirections>;

export default meta;

type Story = StoryObj<typeof meta>;

interface Step {
  step: StepManeuver;
  distanceToNextManeuver: number;
}

const steps: Step[] = [
  {
    step: { lonLat: [0, 0], direction: BranchType.RIGHT },
    distanceToNextManeuver: 250,
  },
  {
    step: {
      lonLat: [0, 0],
      direction: BranchType.LEFT,
      banner: { text: 'Main St' },
    },
    distanceToNextManeuver: 800,
  },
  {
    step: {
      lonLat: [0, 0],
      direction: BranchType.RIGHT,
      laneHint: exampleLaneHint,
    },
    distanceToNextManeuver: 1500,
  },
  {
    step: {
      lonLat: [0, 0],
      direction: BranchType.SLIGHT_LEFT,
      thenHint: { direction: BranchType.RIGHT },
    },
    distanceToNextManeuver: 8000,
  },
];

const initialArgs = {
  units: 'imperial' as const,
  direction: steps[0].step,
  distanceToNextManeuver: steps[0].distanceToNextManeuver,
};

export const TimerCycling: Story = {
  args: initialArgs,
  render: args => {
    const [index, setIndex] = useState(0);
    useEffect(() => {
      const id = setInterval(
        () => setIndex(i => (i + 1) % steps.length),
        1_000,
      );
      return () => clearInterval(id);
    }, []);
    const current = steps[index];
    return (
      <AnimatedDirections
        units={args.units}
        direction={current.step}
        distanceToNextManeuver={current.distanceToNextManeuver}
      />
    );
  },
};

export const ButtonControlled: Story = {
  args: initialArgs,
  render: args => {
    const [index, setIndex] = useState(0);
    const current = steps[index];
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <button
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setIndex(i => (i + 1) % steps.length)}
        >
          Next direction
        </button>
        <AnimatedDirections
          units={args.units}
          direction={current.step}
          distanceToNextManeuver={current.distanceToNextManeuver}
        />
      </div>
    );
  },
};
