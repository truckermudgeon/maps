import { Box, Divider, Stack, Typography } from '@mui/joy';
import type { RouteDirection } from '@truckermudgeon/navigation/types';
import Color from 'color';
import { LaneIcon } from './LaneIcon';

const bgColor = Color('hsl(151,82%,35%)');

export const Directions = (props: RouteDirection) => {
  const hasHint = !!props.laneHint || !!props.thenHint;
  const { length, unit } = toLengthAndUnit(props.distanceMeters);
  return (
    <Stack fontSize={'0.75rem'}>
      <Stack
        direction={'row'}
        alignItems={'center'}
        px={2}
        py={1}
        spacing={2}
        bgcolor={bgColor.string()}
        borderRadius={hasHint ? '1em 1em 1em 0' : '1em'}
      >
        <Stack>
          <Stack direction={'row'} alignItems={'center'} gap={1}>
            <Box width={'6em'}>
              <LaneIcon branches={[props.direction]} dimColor={'#fff'} />
            </Box>
            <Typography
              level={'h1'}
              textColor={'#fff'}
              textAlign={'center'}
              display={'block'}
            >
              {length} {unit}
            </Typography>
          </Stack>
          {props.name && (
            <Typography level={'h2'} fontWeight={'normal'} textColor={'#fff'}>
              {props.name.text}
            </Typography>
          )}
        </Stack>
      </Stack>
      {props.laneHint ? (
        <LaneHint roundBottomLeft={!props.thenHint} hint={props.laneHint} />
      ) : null}
      {props.thenHint && <ThenHint hint={props.thenHint} />}
    </Stack>
  );
};

const LaneHint = (props: {
  hint: NonNullable<RouteDirection['laneHint']>;
  roundBottomLeft: boolean;
}) => {
  return (
    <Box>
      <Stack
        display={'inline-flex'}
        direction={'row'}
        height={'5em'}
        px={2}
        py={1}
        spacing={0.5}
        divider={
          <Divider
            orientation={'vertical'}
            sx={{
              '--Divider-lineColor': '#fffc',
              height: 'calc(0.75em)',
              alignSelf: 'end',
              bottom: '-0.5em', // based on `py` value above
            }}
          />
        }
        sx={{ justifyContent: 'center' }}
        bgcolor={bgColor.darken(0.33).string()}
        borderRadius={`0 0 1em ${props.roundBottomLeft ? '1em' : 0}`}
      >
        {props.hint.lanes.map(({ branches, activeBranch }, i) => (
          <LaneIcon
            key={i}
            branches={branches}
            activeBranch={activeBranch}
            dimColor={bgColor.mix(Color('gray'), 0.5).string()}
            highlightColor={'#fff'}
          />
        ))}
      </Stack>
    </Box>
  );
};

const ThenHint = (props: { hint: NonNullable<RouteDirection['thenHint']> }) => {
  return (
    <Box>
      <Stack
        display={'inline-flex'}
        alignItems={'center'}
        direction={'row'}
        height={'5em'}
        px={2}
        py={1}
        spacing={1}
        bgcolor={bgColor.darken(0.33).string()}
        borderRadius={'0 0 1em 1em'}
      >
        <Typography textColor={'#fff'} level={'body-lg'}>
          Then
        </Typography>
        <Box width={'2.5em'} height={'2.5em'}>
          <LaneIcon
            branches={[props.hint.direction]}
            activeBranch={props.hint.direction}
            highlightColor={'#fff'}
          />
        </Box>
      </Stack>
    </Box>
  );
};

function toLengthAndUnit(meters: number): { length: number; unit: string } {
  const feet = meters * 3.28084;
  if (feet <= 500) {
    return {
      length: Number(Math.round(feet).toPrecision(2)),
      unit: 'ft',
    };
  }
  const miles = meters * 0.0006213712;
  if (miles <= 1) {
    return {
      length: Number(miles.toPrecision(1)),
      unit: 'mi',
    };
  }
  if (miles <= 10) {
    return {
      length: Number(miles.toPrecision(2)),
      unit: 'mi',
    };
  }
  return {
    length: Math.round(miles),
    unit: 'mi',
  };
}
