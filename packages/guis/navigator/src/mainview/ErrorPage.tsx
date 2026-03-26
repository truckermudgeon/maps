import CloudOffIcon from '@mui/icons-material/CloudOff';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import NoTransferOutlinedIcon from '@mui/icons-material/NoTransferOutlined';
import PowerOffOutlinedIcon from '@mui/icons-material/PowerOffOutlined';
import { Box, Stack, Typography } from '@mui/joy';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { ReactElement } from 'react';
import type { TerminalAppState } from './app-store';

export const ErrorPage = ({
  state,
  text,
}: {
  state: TerminalAppState;
  text: string;
}) => {
  let Icon: (props: {
    sx: { width: string; height: string } | undefined;
  }) => ReactElement;
  switch (state) {
    case 'healthError':
      Icon = props => <CloudOffIcon sx={props.sx} />;
      break;
    case 'socketClosed':
    case 'socketError':
      Icon = props => <PowerOffOutlinedIcon sx={props.sx} />;
      break;
    case 'handshakeError':
      Icon = props => <LinkOffIcon sx={props.sx} />;
      break;
    case 'telemetryError':
      Icon = props => <NoTransferOutlinedIcon sx={props.sx} />;
      break;
    default:
      throw new UnreachableError(state);
  }

  return (
    <Stack alignItems={'center'}>
      <Box>
        <Icon sx={{ width: '8em', height: '8em' }} />
      </Box>
      <Typography color={'neutral'} level={'body-md'}>
        {text}
      </Typography>
    </Stack>
  );
};
