import { Box, Divider, Sheet, Stack } from '@mui/joy';
import type { ReactElement } from 'react';

export const NavSheet = (props: {
  TitleControls: () => ReactElement;
  CurrentPage: () => ReactElement;
}) => {
  return (
    <Sheet
      variant={'outlined'}
      sx={{
        p: 2,
        borderRadius: 12,
        height: '100%',
      }}
    >
      <Stack gap={2} height={'100%'} overflow={'hidden'}>
        <props.TitleControls />
        <Divider />
        <Box
          overflow={'auto'}
          display={'flex'}
          justifyContent={'center'}
          sx={{
            // negative margin to counter-act gap.
            // positive padding to counter-act negative margin.
            m: -2,
            p: 2,
          }}
        >
          <props.CurrentPage />
        </Box>
      </Stack>
    </Sheet>
  );
};
