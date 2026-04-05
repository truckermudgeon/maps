import CircleIcon from '@mui/icons-material/Circle';
import type { ColorPaletteProp } from '@mui/joy';
import { Stack, Tooltip, Typography } from '@mui/joy';

export interface StatusProps {
  iconColor: ColorPaletteProp;
  text: string;
  tooltip: string;
}

export const ConnectionStatus = (props: StatusProps) => {
  const { iconColor, text, tooltip } = props;
  return (
    <Tooltip title={iconColor === 'danger' ? '' : tooltip}>
      <Stack direction={'row'} alignItems={'center'} gap={1}>
        <CircleIcon sx={{ color: `${iconColor}.400` }} />
        <Typography
          level={'body-sm'}
          fontWeight={600}
          sx={{ color: `${iconColor}.500` }}
        >
          {text}
        </Typography>
      </Stack>
    </Tooltip>
  );
};
