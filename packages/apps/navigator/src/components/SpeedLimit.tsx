import { Box, Typography } from '@mui/joy';
import { forwardRef } from 'react';

export const SpeedLimit = forwardRef(
  (props: { limitMph?: number; limitKph?: number }, ref) =>
    props.limitMph != null ? (
      <SpeedLimitMph limitMph={props.limitMph} ref={ref} />
    ) : props.limitKph != null ? (
      <SpeedLimitKph limitKph={props.limitKph} ref={ref} />
    ) : null,
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
        {props.limitMph}
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
