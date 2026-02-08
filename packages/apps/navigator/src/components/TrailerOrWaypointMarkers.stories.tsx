import polyline from '@mapbox/polyline';
import type { Meta, StoryContext, StoryObj } from '@storybook/react';
import type { Position } from '@truckermudgeon/base/geom';
import { BranchType } from '@truckermudgeon/navigation/constants';
import type { RouteStep } from '@truckermudgeon/navigation/types';
import * as React from 'react';
import { SlippyMap } from './SlippyMap';
import { Default as SlippyMapDefault } from './SlippyMap.stories';
import { TrailerOrWaypointMarkers } from './TrailerOrWaypointMarkers';

const meta = {
  title: 'Map/Trailer or Waypoint Markers',
  component: TrailerOrWaypointMarkers,
  decorators: [
    (Story: () => React.JSX.Element, context: StoryContext) => (
      <SlippyMap
        {...SlippyMapDefault.args}
        mode={context.globals['theme'] as 'light' | 'dark'}
        TrailerOrWaypointMarkers={Story}
      />
    ),
  ],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TrailerOrWaypointMarkers>;

export default meta;
type Story = StoryObj<typeof meta>;

const fakeLat = 36.282;
const fakeLon = -114.806;

export const NoStops: Story = {
  args: {
    trailerPoint: undefined,
    activeRoute: {
      id: '',
      segments: [
        {
          key: '0-0-forward-fastest',
          steps: [
            aStepWith({
              geometry: [
                [fakeLon, fakeLat],
                [fakeLon + 1, fakeLat + 1],
              ],
            }),
          ],
          distanceMeters: 1,
          duration: 1,
          strategy: 'shortest',
          score: 0,
        },
      ],
      distanceMeters: 1,
      duration: 1,
    },
  },
};

export const WithStops: Story = {
  args: {
    trailerPoint: undefined,
    activeRoute: {
      id: 'id',
      segments: [
        {
          key: '0-0-forward-fastest',
          steps: [
            aStepWith({
              geometry: [
                [fakeLon, fakeLat],
                [fakeLon + 0.5, fakeLat + 0.5],
              ],
            }),
          ],
          distanceMeters: 1,
          duration: 1,
          strategy: 'shortest',
          score: 0,
        },
        {
          key: '0-0-forward-fastest',
          steps: [
            aStepWith({
              geometry: [
                [fakeLon + 0.5, fakeLat - 0.3],
                [fakeLon + 0.7, fakeLat + 0.5],
              ],
            }),
          ],
          distanceMeters: 1,
          duration: 1,
          strategy: 'shortest',
          score: 0,
        },
        {
          key: '0-0-forward-fastest',
          steps: [
            aStepWith({
              geometry: [
                [fakeLon + 0.7, fakeLat + 0.5],
                [fakeLon + 1, fakeLat + 1],
              ],
            }),
          ],
          distanceMeters: 1,
          duration: 1,
          strategy: 'shortest',
          score: 0,
        },
      ],
      distanceMeters: 3,
      duration: 3,
    },
  },
};

export const Trailer: Story = {
  args: {
    trailerPoint: [fakeLon, fakeLat],
    activeRoute: undefined,
  },
};

function aStepWith(
  step: Partial<Omit<RouteStep, 'geometry'>> & { geometry: Position[] },
): RouteStep {
  const geometry = polyline.encode(step.geometry);
  return {
    maneuver: {
      direction: BranchType.RIGHT,
      lonLat: step.geometry[0],
    },
    distanceMeters: 1,
    duration: 1,
    nodesTraveled: 1,
    trafficIcons: [],
    ...step,
    geometry,
  };
}
