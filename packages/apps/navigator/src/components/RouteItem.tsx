import { LocalShipping, Toll } from '@mui/icons-material';
import {
  Box,
  Button,
  ListDivider,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/joy';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type { Mode } from '@truckermudgeon/map/routing';
import type { RouteWithSummary } from '@truckermudgeon/navigation/types';
import type { ReactElement } from 'react';
import { toDuration, toLengthAndUnit } from './text';

export const RouteItem = (props: {
  route: RouteWithSummary;
  onRouteHighlight: () => void;
  onRouteDetailsClick: () => void;
  onRouteGoClick: () => void;
}) => {
  const distanceMetersNum =
    props.route.detour?.distanceMeters ?? props.route.distanceMeters;
  const durationNum = props.route.detour?.duration ?? props.route.duration;

  let distance = toLengthAndUnit(distanceMetersNum, {
    abbreviateUnits: false,
    units: 'imperial',
    forceSingular: props.route.detour != null,
  }).string;
  let duration = toDuration(durationNum, {
    abbreviateUnits: false,
    forceSingular: props.route.detour != null,
  }).string;

  if (props.route.detour) {
    distance = distanceMetersNum <= 0 ? 'Along the way' : `+${distance} detour`;
    duration = durationNum <= 0 ? 'Quick detour' : `+${duration} detour`;
  }

  return (
    <>
      <ListItem>
        <ListItemButton
          onClick={props.onRouteHighlight}
          sx={{ gap: 1, alignItems: 'start' }}
        >
          <Stack direction={'column'} flexGrow={1} gap={1}>
            <Box>
              <Typography fontSize={'x-large'}>{duration}</Typography>
              <Typography color={'neutral'} fontSize={'md'}>
                {distance} &middot;{' '}
                {toModeString(props.route.segments[0].strategy)}
              </Typography>
            </Box>
            <RouteSummary summary={props.route.summary} />
          </Stack>
          <Button
            size={'lg'}
            variant={'outlined'}
            color={'neutral'}
            onClick={e => {
              props.onRouteDetailsClick();
              e.stopPropagation();
            }}
          >
            Details
          </Button>
          <Button
            size={'lg'}
            variant={'solid'}
            color={'success'}
            onClick={e => {
              props.onRouteGoClick();
              e.stopPropagation();
            }}
          >
            Go!
          </Button>
        </ListItemButton>
      </ListItem>
      <ListDivider />
    </>
  );
};

const RouteSummary = ({
  summary,
}: {
  summary: RouteWithSummary['summary'];
}) => {
  const children: ReactElement[] = [];
  for (const grade of summary.grades) {
    children.push(<Grade grade={grade} />);
  }
  for (const road of summary.roads) {
    children.push(
      <Stack direction={'row'} gap={1}>
        <img
          style={{
            width: '24px',
            maxHeight: '24px',
            display: 'block',
            filter: requiresBorder(road)
              ? [
                  'drop-shadow(1px 0 0 black)',
                  'drop-shadow(-1px 0 0 black)',
                  'drop-shadow(0 1px 0 black)',
                  'drop-shadow(0-1px 0 black)',
                ].join(' ')
              : undefined,
          }}
          src={`/icons/${road}.png`}
          alt={road}
        />
        <Typography>{toRoadLabel(road)}</Typography>
      </Stack>,
    );
  }
  if (summary.hasTolls) {
    children.push(
      <Stack direction={'row'} gap={1}>
        <Toll />
        <Typography>This route has tolls</Typography>
      </Stack>,
    );
  }

  return <>{children}</>;
};

const Grade = ({
  grade,
}: {
  grade: RouteWithSummary['summary']['grades'][0];
}) => {
  const { string: distance } = toLengthAndUnit(grade.distance, {
    abbreviateUnits: false,
    units: 'imperial',
    forceSingular: false,
  });
  return (
    <Stack direction={'row'} alignItems={'center'} gap={1}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <LocalShipping
          sx={{
            transform: `translateX(${grade.percentage > 0 ? '' : '-'}0.1em) scale(0.8) scaleX(-1) translateY(-0.125em) rotate(${grade.percentage > 0 ? '-' : ''}20deg)`,
          }}
        />
        <svg
          viewBox={'0 0 24 24'}
          style={{
            position: 'absolute',
            transform: grade.percentage > 0 ? undefined : 'scaleX(-1)',
          }}
        >
          <polygon points={'24,24 0,24, 0,11.5, 24,20.5 24,24'} />
        </svg>
      </Box>
      <Typography>
        {Math.abs(grade.percentage)}%{' '}
        {grade.percentage > 0 ? 'Uphill' : 'Descent'}{' '}
        <Typography fontSize={'sm'} color={'neutral'}>
          for {distance}
        </Typography>
      </Typography>
    </Stack>
  );
};

function requiresBorder(road: string): boolean {
  return /^(us|tx)/.test(road);
}

function toModeString(mode: Mode) {
  switch (mode) {
    case 'fastest':
      return 'Fastest';
    case 'shortest':
      return 'Shortest';
    case 'smallRoads':
      return 'Prefer small roads';
    default:
      throw new UnreachableError(mode);
  }
}

function toRoadLabel(road: string): string {
  // eslint-disable-next-line prefer-const
  let [letters, numbers, maybeSuffix] = road
    .split(/(\d+)/)
    .map(s => s.toUpperCase());
  if (letters === 'IS') {
    letters = 'I';
  } else if (letters === 'CA_R') {
    letters = 'CA';
  } else if (letters === 'TXL') {
    letters = 'TX LOOP';
  }
  Preconditions.checkArgument(/^[a-z ]+$/i.test(letters), letters);
  Preconditions.checkArgument(/^\d+$/.test(numbers), numbers);
  return `${letters}-${numbers}${maybeSuffix ? ' ' + maybeSuffix : ''}`;
}
