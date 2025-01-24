import { ArrowBackIosNew, Close } from '@mui/icons-material';
import { IconButton, Stack, Typography } from '@mui/joy';
import { Collapse } from '@mui/material';

export const TitleControls = (props: {
  showBackButton: boolean;
  title: string;
  onBackClick: () => void;
  onCloseClick: () => void;
}) => (
  <Stack gap={1} direction={'row'} alignItems={'center'}>
    <Collapse in={props.showBackButton} orientation={'horizontal'}>
      <IconButton onClick={props.onBackClick}>
        <ArrowBackIosNew />
      </IconButton>
    </Collapse>
    <Typography flexGrow={1} level={'title-lg'} fontSize={'xl'}>
      {props.title}
    </Typography>
    <IconButton onClick={props.onCloseClick}>
      <Close />
    </IconButton>
  </Stack>
);
