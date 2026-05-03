import { Card, Snackbar } from '@mui/joy';
import { BindingStalePrompt } from './BindingStalePrompt';

export const TelemetryLostToast = (props: {
  open: boolean;
  onRePair: () => void;
}) => {
  return (
    <Snackbar
      open={props.open}
      anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      sx={{
        position: 'absolute',
        bottom: 0,
        pointerEvents: 'auto',
      }}
    >
      <Card
        size={'lg'}
        sx={{ boxShadow: 'lg', overflow: 'hidden', maxWidth: '40ch' }}
      >
        <BindingStalePrompt onRePair={props.onRePair} />
      </Card>
    </Snackbar>
  );
};
