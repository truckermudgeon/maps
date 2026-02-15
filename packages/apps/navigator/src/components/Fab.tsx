import { IconButton } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';
import { Collapse, Zoom } from '@mui/material';
import type { ReactElement } from 'react';
import { useRef } from 'react';

const fabStyle: SxProps = {
  p: 2,
  borderRadius: '50%',
};

export const Fab = (props: {
  show: boolean;
  variant?: 'solid' | 'plain'; // defaults to 'solid'
  backgroundColor?: string; // defaults to 'primary.500'
  Icon: () => ReactElement;
  onClick: () => void;
}) => {
  const ref = useRef<HTMLButtonElement | null>(null);

  return (
    <Collapse
      in={props.show}
      collapsedSize={0}
      onExiting={() => {
        if (ref.current) {
          ref.current.style.boxShadow = 'none';
          ref.current.style.transitionDuration = '100ms';
          ref.current.style.transitionDelay = '0ms';
        }
      }}
      onEntering={() => {
        if (ref.current) {
          ref.current.style.boxShadow =
            'rgba(0, 0, 0, 0.2) 0 3px 5px -1px, rgba(0, 0, 0, 0.14) 0 6px 10px 0, rgba(0, 0, 0, 0.12) 0 1px 18px 0';
          ref.current.style.transitionDuration = '500ms';
          ref.current.style.transitionDelay = '300ms';
        }
      }}
      appear={true}
    >
      <Zoom in={props.show} appear={true}>
        <div style={{ padding: '0.5em' }}>
          <IconButton
            ref={ref}
            size={'lg'}
            color={'primary'}
            variant={props.variant ?? 'solid'}
            sx={{
              ...fabStyle,
              backgroundColor: props.backgroundColor ?? 'primary.500',
            }}
            style={{
              transition: 'box-shadow',
              transitionDuration: '500ms',
              transitionDelay: '500ms',
            }}
            onClick={props.onClick}
          >
            <props.Icon />
          </IconButton>
        </div>
      </Zoom>
    </Collapse>
  );
};
