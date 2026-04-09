import { Box, Stack, Typography } from '@mui/joy';
import { forwardRef } from 'react';

export interface SpeedLimitProps {
  units: 'metric' | 'imperial';
  speed: number;
  limit: number;
}

export const SpeedLimit = forwardRef((props: SpeedLimitProps, ref) => {
  const limitSign =
    props.units === 'imperial' ? (
      <SpeedLimitMph limit={props.limit} ref={ref} />
    ) : (
      <SpeedLimitKph limit={props.limit} ref={ref} />
    );

  const effectiveLimit = props.limit < 5 ? Infinity : props.limit;
  const ratio = props.speed / effectiveLimit;
  const color = ratio <= 1 ? 'white' : ratio <= 1.1 ? 'orange' : 'red';

  return (
    <Stack
      display={'grid'}
      gridTemplateColumns={'1fr 1fr'}
      gap={0.25}
      sx={{
        backgroundColor: '#000',
        p: 0.25,
        pr: props.units === 'imperial' ? undefined : 1,
      }}
      borderRadius={props.units === 'imperial' ? '0.5em' : '8em'}
    >
      {limitSign}
      <Stack justifyContent={'center'}>
        <Typography
          textAlign={'center'}
          level={'title-lg'}
          fontSize={'xl2'}
          fontWeight={'bold'}
          sx={{
            color,
            WebkitTextStroke: 1.25,
          }}
        >
          {Math.round(props.speed) || '--'}
        </Typography>
        <Typography
          textAlign={'center'}
          lineHeight={1}
          level={'body-md'}
          sx={{ color }}
        >
          {props.units === 'imperial' ? 'mph' : 'kph'}
        </Typography>
      </Stack>
    </Stack>
  );
});

const SpeedLimitMph = forwardRef((props: { limit: number }, ref) => (
  <Box
    boxShadow={'0 0 2px 0 #0008'}
    padding={0.25}
    borderRadius={'0.5em'}
    sx={{ backgroundColor: 'white' }}
    ref={ref}
  >
    <Box
      border={2}
      borderColor={'common.black'}
      padding={0.5}
      paddingBottom={0}
      borderRadius={'0.5em'}
    >
      <Typography
        textAlign={'center'}
        lineHeight={1.2}
        level={'body-xs'}
        sx={{ color: 'common.black' }}
      >
        SPEED
        <br />
        LIMIT
      </Typography>
      <Typography
        textAlign={'center'}
        level={'title-lg'}
        fontSize={'xl2'}
        fontWeight={'bold'}
        sx={{
          color: 'common.black',
          WebkitTextStroke: 1.25,
        }}
      >
        {props.limit < 5 ? '--' : props.limit}
      </Typography>
    </Box>
  </Box>
));

const SpeedLimitKph = forwardRef((props: { limit: number }, ref) => (
  <Box
    boxShadow={'0 0 2px 0 #0004'}
    padding={0.2}
    borderRadius={'50%'}
    border={1}
    borderColor={'#f22'}
    minWidth={'4em'}
    sx={{ backgroundColor: 'white' }}
    ref={ref}
  >
    <Box
      display={'flex'}
      alignItems={'center'}
      justifyContent={'center'}
      border={6}
      borderColor={'#f22'}
      padding={1}
      borderRadius={'50%'}
      sx={{
        aspectRatio: 1,
      }}
    >
      <Typography
        textAlign={'center'}
        level={'title-lg'}
        fontSize={'xl2'}
        fontWeight={'bold'}
        sx={{
          color: 'common.black',
          WebkitTextStroke: 1.25,
        }}
      >
        {props.limit < 5 ? '--' : props.limit}
      </Typography>
    </Box>
  </Box>
));
