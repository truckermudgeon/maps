import {
  Button,
  Card,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/joy';

export const WaitingForTelemetry = (props: {
  bindingStale: boolean;
  onRePair: () => void;
}) => {
  const { bindingStale, onRePair } = props;

  return (
    <Stack
      justifyContent={'center'}
      alignItems={'center'}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        zIndex: 9999,
      }}
      bgcolor={'#0005'}
    >
      <Card
        size={'lg'}
        sx={{ boxShadow: 'lg', overflow: 'hidden', maxWidth: '40ch' }}
      >
        {bindingStale ? (
          <>
            <Typography fontSize={'lg'}>Still no game telemetry.</Typography>
            <Typography fontSize={'sm'} color={'neutral'}>
              The connection may have stalled while the game or Navigator client
              was starting. Try reconnecting first; if that doesn't help,
              re-pair the device.
            </Typography>
            <Divider />
            <Stack direction={'row'} spacing={1} justifyContent={'flex-end'}>
              <Button
                variant={'outlined'}
                color={'neutral'}
                onClick={() => window.location.reload()}
              >
                Try again
              </Button>
              <Button variant={'solid'} color={'primary'} onClick={onRePair}>
                Re-pair device
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <Typography
              fontSize={'lg'}
              display={'flex'}
              justifyContent={'center'}
              alignItems={'center'}
              gap={1}
            >
              <CircularProgress
                variant="solid"
                size={'sm'}
                color={'neutral'}
                sx={{ mr: 1 }}
              />
              Waiting for game telemetry...
            </Typography>
            <Divider />
            <Typography fontSize={'sm'} color={'neutral'}>
              Please make sure:
              <ul style={{ paddingLeft: '1.5em', margin: '1ex 0 0 0' }}>
                <li>ATS and the Navigator client are running</li>
                <li>your truck is on the road</li>
              </ul>
            </Typography>
          </>
        )}
      </Card>
    </Stack>
  );
};
