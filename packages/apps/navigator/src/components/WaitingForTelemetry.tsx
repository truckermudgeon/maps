import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import {
  Button,
  Card,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/joy';

export type WaitingForTelemetryState = 'awaiting' | 'orphaned' | 'lost';

export const WaitingForTelemetry = (props: {
  state: WaitingForTelemetryState;
  onRePair: () => void;
}) => {
  const { state, onRePair } = props;

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
        <Typography
          fontSize={'lg'}
          display={'flex'}
          justifyContent={'center'}
          alignItems={'center'}
          gap={1}
        >
          {state === 'lost' ? (
            <SyncProblemIcon color={'warning'} sx={{ mr: 1 }} />
          ) : (
            <CircularProgress
              variant="solid"
              size={'sm'}
              color={'neutral'}
              sx={{ mr: 1 }}
            />
          )}
          {titleFor(state)}
        </Typography>
        <Divider />
        {state === 'lost' ? (
          <Typography fontSize={'sm'} color={'neutral'}>
            Updates from the game or Navigator client have stopped. This will
            clear when they resume.
          </Typography>
        ) : (
          <Typography component={'div'} fontSize={'sm'} color={'neutral'}>
            Please make sure:
            <ul style={{ paddingLeft: '1.5em', margin: '1ex 0 0 0' }}>
              <li>ATS or ETS2 is running</li>
              <li>the Navigator client is running</li>
              <li>your truck is on the road</li>
            </ul>
          </Typography>
        )}
        {state !== 'awaiting' && (
          <Stack>
            <Typography fontSize={'sm'} color={'neutral'}>
              {state === 'lost' ? (
                <>
                  Otherwise, use <b>Try again</b> to reload, or{' '}
                  <b>Enter pairing code</b> to switch clients.
                </>
              ) : (
                <>
                  Use <b>Try again</b> to force a reconnect, or{' '}
                  <b>Enter pairing code</b> to start over.
                </>
              )}
            </Typography>
            <Stack
              direction={'row'}
              spacing={1}
              justifyContent={'flex-end'}
              sx={{ mt: 2 }}
            >
              <Button
                variant={'outlined'}
                color={'neutral'}
                onClick={() => window.location.reload()}
              >
                Try again
              </Button>
              <Button variant={'solid'} color={'primary'} onClick={onRePair}>
                Enter pairing code
              </Button>
            </Stack>
          </Stack>
        )}
      </Card>
    </Stack>
  );
};

function titleFor(state: WaitingForTelemetryState): string {
  switch (state) {
    case 'awaiting':
      return 'Waiting for game telemetry...';
    case 'orphaned':
      return 'Still waiting for game telemetry...';
    case 'lost':
      return 'Game telemetry lost';
  }
}
