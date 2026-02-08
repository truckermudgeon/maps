import { Box, Divider, Stack, Typography } from '@mui/joy';
import type { BranchType } from '@truckermudgeon/navigation/constants';
import type { StepManeuver } from '@truckermudgeon/navigation/types';
import Color from 'color';
import { memo } from 'react';
import { LaneIcon } from './LaneIcon';

const bgColor = Color('hsl(151,82%,35%)');

type DirectionsProps = Pick<
  StepManeuver,
  'direction' | 'banner' | 'laneHint' | 'thenHint'
> & { length: number; unit: string };

export const Directions = memo((props: DirectionsProps) => {
  console.log('render Directions');
  const hasHint = !!props.laneHint || !!props.thenHint;
  const { length, unit } = props;
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
              <LaneIcon
                // TODO take into account 'depart' and 'arrive'
                branches={[props.direction as unknown as BranchType]}
                dimColor={'#fff'}
              />
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
          {props.banner && (
            <Typography level={'h2'} fontWeight={'normal'} textColor={'#fff'}>
              {props.banner.text}
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
});

const LaneHint = (props: {
  hint: NonNullable<StepManeuver['laneHint']>;
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
          <Box width={44} key={i}>
            <LaneIcon
              branches={branches}
              activeBranch={activeBranch}
              dimColor={bgColor.mix(Color('gray'), 0.5).string()}
              highlightColor={'#fff'}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

const ThenHint = (props: { hint: NonNullable<StepManeuver['thenHint']> }) => {
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
