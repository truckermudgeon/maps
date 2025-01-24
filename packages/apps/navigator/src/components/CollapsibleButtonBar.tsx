import { AltRoute } from '@mui/icons-material';
import { Button, ButtonGroup } from '@mui/joy';
import { Collapse } from '@mui/material';

export const CollapsibleButtonBar = (props: {
  visible: boolean;
  onDestinationRoutesClick: () => void;
  onDestinationGoClick: () => void;
}) => {
  console.log('render collapsible button bar');
  return (
    <Collapse in={props.visible}>
      <ButtonGroup
        variant={'outlined'}
        size={'lg'}
        buttonFlex={'1 0 50%'}
        sx={{ mt: 2, mb: 1 }}
      >
        <Button
          startDecorator={<AltRoute />}
          onClick={e => {
            props.onDestinationRoutesClick();
            e.stopPropagation();
          }}
        >
          Routes
        </Button>
        <Button
          variant={'solid'}
          color={'success'}
          onClick={e => {
            props.onDestinationGoClick();
            e.stopPropagation();
          }}
        >
          Go!
        </Button>
      </ButtonGroup>
    </Collapse>
  );
};
