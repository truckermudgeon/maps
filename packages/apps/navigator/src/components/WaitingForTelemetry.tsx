import { Card, CircularProgress, Divider, Stack, Typography } from '@mui/joy';

export const WaitingForTelemetry = () => {
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
      </Card>
    </Stack>
  );
};
