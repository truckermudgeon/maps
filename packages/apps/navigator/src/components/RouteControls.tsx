import {
  AltRoute,
  FormatListBulleted,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Search,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  IconButton,
  List,
  ListDivider,
  ListItem,
  ListItemButton,
  ListItemDecorator,
  Stack,
  Typography,
} from '@mui/joy';
import { Collapse } from '@mui/material';
import { useEffect, useRef } from 'react';

interface RouteControlsProps {
  summary: {
    minutes: number;
    distanceMeters: number;
  };
  expanded: boolean;
  onDisclosureClick: () => void;
  onRouteEndClick: () => void;
}

export const RouteControls = (props: RouteControlsProps) => {
  const DisclosureIcon = props.expanded ? KeyboardArrowDown : KeyboardArrowUp;
  console.log('render RouteControls. expanded?', props.expanded);

  return (
    <Card
      sx={{
        boxShadow:
          'rgba(0, 0, 0, 0.2) 0px 3px 5px -1px, rgba(0, 0, 0, 0.14) 0px 6px 10px 0px, rgba(0, 0, 0, 0.12) 0px 1px 18px 0px',
        // TODO make this consistent across all corner-rounded components
        borderRadius: 12,
        pb: props.expanded ? 2 : 0,
        height: '100%',
      }}
    >
      <Stack
        direction={'row'}
        spacing={2}
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Stack alignItems={'center'}>
          <Typography level={'h3'} fontWeight={'bold'}>
            12:34
          </Typography>
          <Typography>arrival</Typography>
        </Stack>
        <Stack alignItems={'center'}>
          <Typography level={'h3'}>2:34</Typography>
          <Typography>
            {props.summary.minutes < 60 ? 'minutes' : 'hours'}
          </Typography>
        </Stack>
        <Stack alignItems={'center'}>
          <Typography level={'h3'}>12</Typography>
          <Typography>mi</Typography>
        </Stack>
        <IconButton
          size={'lg'}
          variant={'soft'}
          onClick={props.onDisclosureClick}
        >
          <DisclosureIcon sx={{ transform: 'scale(1.25)' }} />
        </IconButton>
      </Stack>
      <Box overflow={'scroll'}>
        <ExpandedControls
          expanded={props.expanded}
          onRouteEndClick={props.onRouteEndClick}
        />
      </Box>
    </Card>
  );
};

const ExpandedControls = ({
  expanded,
  onRouteEndClick,
}: {
  expanded: boolean;
  onRouteEndClick: () => void;
}) => {
  const ref = useRef<HTMLElement>();
  useEffect(() => {
    if (expanded) {
      setTimeout(() => {
        ref.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
      }, 250);
    }
  }, [expanded]);

  return (
    <Collapse in={expanded}>
      <List size={'lg'}>
        <ListDivider />
        <ListItem>
          <ListItemButton>
            <ListItemDecorator>
              <Search sx={{ transform: 'scale(1.25)' }} />
            </ListItemDecorator>
            Search along route
          </ListItemButton>
        </ListItem>
        <ListDivider />
        <ListItem>
          <ListItemButton>
            <ListItemDecorator>
              <AltRoute sx={{ transform: 'scale(1.25)' }} />
            </ListItemDecorator>
            Preview route
          </ListItemButton>
        </ListItem>
        <ListDivider />
        <ListItem>
          <ListItemButton>
            <ListItemDecorator>
              <FormatListBulleted sx={{ transform: 'scale(1.25)' }} />
            </ListItemDecorator>
            Directions
          </ListItemButton>
        </ListItem>

        <ListDivider />
        <Button
          sx={{ mt: 2 }}
          size={'lg'}
          color={'danger'}
          onClick={onRouteEndClick}
        >
          End Route
        </Button>
        <Box ref={ref} />
      </List>
    </Collapse>
  );
};
