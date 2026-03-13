import { Box, Stack, Typography, useColorScheme } from '@mui/joy';
import { renderSVG } from 'uqr';

export interface QrCodeProps {
  pairingCode: string;
  navigatorUrl: string;
}

export const QrCode = (props: QrCodeProps) => {
  const { pairingCode, navigatorUrl } = props;
  const { mode: _maybeMode, systemMode } = useColorScheme();
  const mode = (_maybeMode === 'system' ? systemMode : _maybeMode) ?? 'light';

  return (
    <Stack
      flex={1}
      gap={2}
      sx={{
        height: '100%',
        alignItems: 'center',
      }}
    >
      <Typography width={'100%'} fontSize={'sm'} sx={{ color: 'neutral.500' }}>
        Or scan QR code:
      </Typography>
      <Box
        sx={{ width: '90%', pt: 1, ml: -0.5 }}
        dangerouslySetInnerHTML={{
          __html: renderSVG(`${navigatorUrl}/?pair=${pairingCode}`, {
            whiteColor: 'transparent',
            blackColor: mode === 'light' ? 'black' : 'white',
          }),
        }}
      />
    </Stack>
  );
};
