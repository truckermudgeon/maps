import { IconButton } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { Zoom } from '@mui/material';
import type { ReactElement } from 'react';

const fabStyle: SxProps = {
  p: 2,
  borderRadius: '50%',
  boxShadow:
    'rgba(0, 0, 0, 0.2) 0px 3px 5px -1px, rgba(0, 0, 0, 0.14) 0px 6px 10px 0px, rgba(0, 0, 0, 0.12) 0px 1px 18px 0px',
};

export const Fab = (props: {
  show: boolean;
  variant?: 'solid' | 'plain'; // defaults to 'solid'
  backgroundColor?: string; // defaults to 'primary.500'
  Icon: () => ReactElement;
  onClick: () => void;
}) => {
  return (
    <Zoom in={props.show} mountOnEnter unmountOnExit>
      <IconButton
        size={'lg'}
        color={'primary'}
        variant={props.variant ?? 'solid'}
        sx={{
          ...fabStyle,
          backgroundColor: props.backgroundColor ?? 'primary.500',
        }}
        onClick={props.onClick}
      >
        <props.Icon />
      </IconButton>
    </Zoom>
  );
};
