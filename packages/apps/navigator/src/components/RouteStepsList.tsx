import {
  IconButton,
  List,
  ListDivider,
  ListItem,
  ListItemButton,
  ListItemDecorator,
  useColorScheme,
} from '@mui/joy';
import type { BranchType } from '@truckermudgeon/navigation/constants';
import type {
  Route,
  RouteSegment,
  RouteStep,
} from '@truckermudgeon/navigation/types';
import type { ReactElement, ReactNode } from 'react';
import { LaneIcon } from './LaneIcon';
import { toLengthAndUnit, toStepText } from './text';

export const RouteStepsList = (props: {
  route: Route;
  onStepClick?: (step: RouteStep) => void;
}) => {
  console.log('render route steps list');
  const { mode: _maybeMode, systemMode } = useColorScheme();
  const mode = (_maybeMode === 'system' ? systemMode : _maybeMode) ?? 'light';

  const _StepIcon = ({ direction }: { direction: BranchType }) => (
    <StepIcon direction={direction} mode={mode} />
  );

  const _RouteStep = ({ step }: { step: RouteStep }) => (
    <RouteStep
      step={step}
      onStepClick={props.onStepClick}
      StepIcon={_StepIcon}
    />
  );

  return (
    <List size={'md'}>
      {props.route.segments.map(segment => (
        <RouteSegment
          key={segment.key}
          segment={segment}
          RouteStep={_RouteStep}
        />
      ))}
    </List>
  );
};

const RouteSegment = (props: {
  segment: RouteSegment;
  RouteStep: (props: { step: RouteStep }) => ReactElement;
}) => {
  return (
    <List>
      {props.segment.steps.map((step, index) => (
        <props.RouteStep key={index} step={step} />
      ))}
    </List>
  );
};

const RouteStep = (props: {
  step: RouteStep;
  onStepClick?: (step: RouteStep) => void;
  StepIcon: (props: { direction: BranchType }) => ReactElement;
}) => {
  const {
    step,
    step: { maneuver },
    onStepClick,
    StepIcon,
  } = props;
  const distance = toLengthAndUnit(step.distanceMeters, {
    abbreviateUnits: false,
    units: 'imperial',
    forceSingular: false,
  }).string;
  const Wrapper = ({ children }: { children: ReactNode }) =>
    onStepClick ? (
      <ListItemButton sx={{ py: 0.125 }} onClick={() => onStepClick(step)}>
        {children}
      </ListItemButton>
    ) : (
      <>{children}</>
    );

  return (
    <>
      <ListItem>
        <Wrapper>
          <ListItemDecorator sx={{ m: 0, justifyContent: 'center' }}>
            <IconButton size={'md'}>
              <StepIcon direction={maneuver.direction} />
            </IconButton>
          </ListItemDecorator>
          {toStepText(maneuver)}
        </Wrapper>
      </ListItem>
      {step.distanceMeters > 0 && (
        <ListDivider
          inset={'startContent'}
          sx={{
            ['--Divider-childPosition']: '0%',
            marginInlineStart: 8,
          }}
        >
          {distance}
        </ListDivider>
      )}
    </>
  );
};

const StepIcon = (props: { direction: BranchType; mode: 'light' | 'dark' }) => {
  return (
    <LaneIcon
      branches={[props.direction]}
      // TODO use theme colors
      dimColor={props.mode === 'light' ? '#333' : '#ddd'}
    />
  );
};
