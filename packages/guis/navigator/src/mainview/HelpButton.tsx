import InfoOutlinedIcon from '@mui/icons-material/InfoOutline';
import { IconButton, Tooltip } from '@mui/joy';

interface HelpButtonProps {
  onClick: () => void;
}

export function HelpButton(props: HelpButtonProps) {
  return (
    <Tooltip title={'About'}>
      <IconButton onClick={props.onClick} variant={'plain'} size={'sm'}>
        <InfoOutlinedIcon sx={{ color: 'neutral.500' }} />
      </IconButton>
    </Tooltip>
  );
}
