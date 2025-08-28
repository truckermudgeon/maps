import { Box, Stack } from '@mui/joy';
import { Collapse, Slide } from '@mui/material';
import { useMeasure } from '@uidotdev/usehooks';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { RouteControls } from './RouteControls';

export const RouteStack = (props: {
  Guidance: () => ReactElement;
  onRouteEndClick: () => void;
}) => {
  const { Guidance, onRouteEndClick } = props;
  const [stackRef, { height: stackHeight }] = useMeasure();
  //const [guidanceRef, { height: guidanceHeight }] = useMeasure();
  //const [routeControlsRef, { height: routeControlsHeight }] = useMeasure();
  const [expanded, setExpanded] = useState(false);
  const toggleDisclosure = useCallback(
    () => setExpanded(!expanded),
    [expanded],
  );
  const handleRouteEndClick = () => {
    onRouteEndClick();
    setExpanded(false);
  };
  // HACK until there's a nice way to figure this out for real.
  const needsExpanding = (stackHeight ?? 0) < 520;

  return (
    <Box ref={stackRef} height={'100%'}>
      <Stack
        height={'100%'}
        style={{
          transition: 'all 0.5s ease',
        }}
        justifyContent={'space-between'}
      >
        <Box sx={{ pointerEvents: 'auto' }}>
          <Slide in={!needsExpanding || !expanded} appear={false}>
            <Box /* ref={guidanceRef} */>
              <Collapse in={!needsExpanding || !expanded} appear={false}>
                <Guidance />
              </Collapse>
            </Box>
          </Slide>
        </Box>
        <Box
          //ref={routeControlsRef}
          sx={{
            pointerEvents: 'auto',
            maxHeight: `calc(${stackHeight}px - 1em)`,
          }}
        >
          <RouteControls
            summary={{ minutes: 95, distanceMeters: 1234 }}
            expanded={expanded}
            onDisclosureClick={toggleDisclosure}
            onRouteEndClick={handleRouteEndClick}
          />
        </Box>
      </Stack>
    </Box>
  );
};
