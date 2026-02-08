import { Button, Snackbar, Stack, Typography } from '@mui/joy';

export interface SegmentCompleteToastProps {
  open: boolean;
  place: string;
  placeInfo: string;
  isFinalSegment: boolean;
  onContinueClick: () => void;
  onEndClick: () => void;
}

export const SegmentCompleteToast = (props: SegmentCompleteToastProps) => {
  return (
    <Snackbar
      open={props.open}
      anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      sx={{
        flexDirection: 'column',
        width: '100%',
        position: 'absolute',
        bottom: 0,
        pointerEvents: 'auto', // HACK. should be handled by container.
      }}
    >
      <Stack gap={1} width={'100%'}>
        <Typography level={'h3'}>You have arrived</Typography>
        <Typography level={'h4'} color={'neutral'}>
          {props.place}{' '}
          <Typography color={'neutral'}>{props.placeInfo}</Typography>
        </Typography>
      </Stack>
      <Stack gap={1} width={'100%'}>
        {!props.isFinalSegment && (
          <Button size={'lg'} onClick={props.onContinueClick}>
            Continue
          </Button>
        )}
        <Button
          size={'lg'}
          variant={!props.isFinalSegment ? 'outlined' : 'solid'}
          onClick={props.onEndClick}
        >
          End Trip
        </Button>
      </Stack>
    </Snackbar>
  );
};
