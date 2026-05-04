import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import { Card, CircularProgress, Divider, Stack, Typography } from '@mui/joy';
import { BindingStalePrompt } from './BindingStalePrompt';

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
        <Typography component={'div'} fontSize={'sm'} color={'neutral'}>
          Please make sure:
          <ul style={{ paddingLeft: '1.5em', margin: '1ex 0 0 0' }}>
            <li>ATS or ETS2 is running</li>
            <li>the Navigator client is running</li>
            <li>your truck is on the road</li>
          </ul>
        </Typography>
        {state !== 'awaiting' && <BindingStalePrompt onRePair={onRePair} />}
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
