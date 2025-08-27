import { Box, Stack, Typography } from '@mui/joy';
import { forwardRef } from 'react';

// TODO make units more explicit via prop.

export const SpeedLimit = forwardRef(
  (props: { limitMph?: number; speedMph: number; limitKph?: number }, ref) => {
    const limitSign =
      props.limitMph != null ? (
        <SpeedLimitMph limitMph={props.limitMph} ref={ref} />
      ) : props.limitKph != null ? (
        <SpeedLimitKph limitKph={props.limitKph} ref={ref} />
      ) : null;

    const effectiveLimit =
      (props.limitMph ?? 0) < 5 ? Infinity : (props.limitMph ?? 0);
    const ratio = props.speedMph / effectiveLimit;
    const color = ratio <= 1 ? 'white' : ratio <= 1.1 ? 'orange' : 'red';

    return (
      <Stack
        display={'grid'}
        gridTemplateColumns={'1fr 1fr'}
        gap={0.25}
        sx={{
          backgroundColor: '#000',
          p: 0.25,
        }}
        borderRadius={4}
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
            {Math.round(props.speedMph) || '--'}
          </Typography>
          <Typography
            textAlign={'center'}
            lineHeight={1}
            level={'body-md'}
            sx={{ color }}
          >
            mph
          </Typography>
        </Stack>
      </Stack>
    );
  },
);

const SpeedLimitMph = forwardRef((props: { limitMph: number }, ref) => (
  <Box
    boxShadow={'0 0 2px 0 #0008'}
    padding={0.25}
    borderRadius={4}
    sx={{ backgroundColor: 'white' }}
    ref={ref}
  >
    <Box
      border={2}
      borderColor={'common.black'}
      padding={0.5}
      paddingBottom={0}
      borderRadius={4}
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
        {props.limitMph < 5 ? '--' : props.limitMph}
      </Typography>
    </Box>
  </Box>
));

const SpeedLimitKph = forwardRef((props: { limitKph: number }, ref) => (
  <Box
    boxShadow={'0 0 2px 0 #0004'}
    padding={0.2}
    borderRadius={'50%'}
    border={1}
    borderColor={'#f22'}
    sx={{ backgroundColor: 'white' }}
    ref={ref}
  >
    <Box
      display={'flex'}
      alignItems={'center'}
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
        {props.limitKph}
      </Typography>
    </Box>
  </Box>
));
