import { Button, Divider, Stack, Typography } from '@mui/joy';

export const BindingStalePrompt = (props: { onRePair: () => void }) => {
  const { onRePair } = props;
  return (
    <>
      <Typography fontSize={'lg'}>Still no game telemetry.</Typography>
      <Typography fontSize={'sm'} color={'neutral'}>
        This will clear automatically if telemetry comes back. Use Try again to
        force a reconnect, or Re-pair device if you've paired with a different
        client.
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
  );
};
