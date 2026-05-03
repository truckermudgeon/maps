import { Button, Stack, Typography } from '@mui/joy';

export const BindingStalePrompt = (props: { onRePair: () => void }) => {
  const { onRePair } = props;
  return (
    <>
      <Typography fontSize={'sm'} color={'neutral'}>
        Use <b>Try again</b> to force a reconnect, or <b>Enter pairing code</b>{' '}
        to start over.
      </Typography>
      <Stack
        direction={'row'}
        spacing={1}
        justifyContent={'flex-end'}
        sx={{ mt: 1 }}
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
    </>
  );
};
