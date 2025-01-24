import { Box, Typography } from '@mui/joy';
import { forwardRef } from 'react';

export const SpeedLimit = forwardRef((props: { limitMph: number }, ref) => (
  <Box
    boxShadow={'0 0 2px 0 #0008'}
    padding={0.25}
    borderRadius={4}
    sx={{ backgroundColor: 'white' }}
    ref={ref}
  >
    <Box border={2} padding={0.5} paddingBottom={0} borderRadius={4}>
      <Typography textAlign={'center'} lineHeight={1.2} level={'body-xs'}>
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
          WebkitTextStroke: 1.25,
        }}
      >
        {props.limitMph}
      </Typography>
    </Box>
  </Box>
));
