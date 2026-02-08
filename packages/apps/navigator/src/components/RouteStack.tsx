import { Box, Stack } from '@mui/joy';
import { Collapse, Slide } from '@mui/material';
import { useMeasure } from '@uidotdev/usehooks';
import type { ReactElement } from 'react';
import { useState } from 'react';

export const RouteStack = (props: {
  Guidance: () => ReactElement;
  RouteControls: (props: {
    onExpandedToggle: (expanded: boolean) => void;
  }) => ReactElement;
  SegmentCompleteToast: () => ReactElement;
}) => {
  const { Guidance, RouteControls, SegmentCompleteToast } = props;
  const [stackRef, { height: stackHeight }] = useMeasure();
  //const [guidanceRef, { height: guidanceHeight }] = useMeasure();
  //const [routeControlsRef, { height: routeControlsHeight }] = useMeasure();
  const [expanded, setExpanded] = useState(false);
  // HACK until there's a nice way to figure this out for real.
  const needsExpanding = (stackHeight ?? 0) < 520;

  return (
    <Box ref={stackRef} height={'100%'}>
      <Stack
        height={'100%'}
        style={{
          transition: 'all 0.5s ease',
          position: 'relative',
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
          <RouteControls onExpandedToggle={setExpanded} />
        </Box>
        <SegmentCompleteToast />
      </Stack>
    </Box>
  );
};
