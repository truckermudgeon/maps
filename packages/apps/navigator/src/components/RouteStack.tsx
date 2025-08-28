import { Box, Stack } from '@mui/joy';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { RouteControls } from './RouteControls';

export const RouteStack = (props: { Guidance: () => ReactElement }) => {
  const { Guidance } = props;
  const [expanded, setExpanded] = useState(false);
  const toggleDisclosure = useCallback(
    () => setExpanded(!expanded),
    [expanded],
  );

  return (
    <Stack height={'100%'} justifyContent={'space-between'}>
      <Box sx={{ pointerEvents: 'auto' }}>
        <Guidance />
      </Box>
      <Box sx={{ pointerEvents: 'auto' }}>
        <RouteControls
          summary={{ minutes: 95, distanceMeters: 1234 }}
          expanded={expanded}
          onDisclosureClick={toggleDisclosure}
        />
      </Box>
    </Stack>
  );
};
