import { Stack } from '@mui/joy';
import type { ReactElement } from 'react';

export const HudStack = (props: {
  Direction: () => ReactElement;
  SpeedLimit: () => ReactElement;
  RecenterFab: () => ReactElement;
  RouteFab: () => ReactElement;
  SearchFab: () => ReactElement;
}) => {
  console.log('render controls');
  return (
    <Stack
      direction={'column'}
      justifyContent={'space-between'}
      sx={{
        border: `1px solid red`,
      }}
    >
      <Stack
        gap={1}
        alignSelf={'end'}
        alignItems={'end'}
        sx={{ pointerEvents: 'auto' }}
      >
        <props.Direction />
        <props.SpeedLimit />
      </Stack>
      <Stack
        gap={2}
        alignSelf={'end'}
        alignItems={'center'}
        sx={{ pointerEvents: 'auto' }}
      >
        <props.RecenterFab />
        <props.RouteFab />
        <props.SearchFab />
      </Stack>
    </Stack>
  );
};
