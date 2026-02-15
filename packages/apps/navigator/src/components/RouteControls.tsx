import {
  AltRoute,
  EditLocationAlt,
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { toDuration } from './text';

export interface RouteControlsProps {
  summary: {
    minutes: number;
    distance: { length: number; unit: string };
  };
  onExpandedToggle: (expanded: boolean) => void;
  onManageStopsClick?: () => void;
  onSearchAlongRouteClick: () => void;
  onRoutePreviewClick: () => void;
  onRouteDirectionsClick: () => void;
  onRouteEndClick: () => void;
}

// TODO break this up to prevent re-renders
export const RouteControls = (props: RouteControlsProps) => {
  console.log('render route controls');
  const {
    summary: { minutes, distance },
  } = props;
  const [expanded, setExpanded] = useState(false);
  const DisclosureIcon = expanded ? KeyboardArrowDown : KeyboardArrowUp;
  const toggleDisclosure = useCallback(() => {
    setExpanded(!expanded);
    props.onExpandedToggle(!expanded);
  }, [expanded]);
  const withClose = (fn: () => void) => () => {
    fn();
    setExpanded(false);
    props.onExpandedToggle(false);
  };

  const duration = toDuration(minutes * 60);
  const arrival = new Date(Date.now() + minutes * 60_000);
  const arrivalTimeString = new Intl.DateTimeFormat('en-US', {
    timeStyle: 'short',
  }).format(arrival);

  return (
    <Card
      sx={{
        boxShadow:
          'rgba(0, 0, 0, 0.2) 0px 3px 5px -1px, rgba(0, 0, 0, 0.14) 0px 6px 10px 0px, rgba(0, 0, 0, 0.12) 0px 1px 18px 0px',
        // TODO make this consistent across all corner-rounded components
        borderRadius: 12,
        pb: expanded ? 2 : 0,
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
            {arrivalTimeString}
          </Typography>
          <Typography>arrival</Typography>
        </Stack>
        <Stack alignItems={'center'}>
          <Typography level={'h3'}>
            {duration.hours}:
            {duration.minutes < 10 ? `0${duration.minutes}` : duration.minutes}
          </Typography>
          <Typography>{minutes < 60 ? 'minutes' : 'hours'}</Typography>
        </Stack>
        <Stack alignItems={'center'}>
          <Typography level={'h3'}>{distance.length}</Typography>
          <Typography>{distance.unit}</Typography>
        </Stack>
        <IconButton size={'lg'} variant={'soft'} onClick={toggleDisclosure}>
          <DisclosureIcon sx={{ transform: 'scale(1.25)' }} />
        </IconButton>
      </Stack>
      <Box sx={{ overflowY: 'scroll' }}>
        <ExpandedControls
          expanded={expanded}
          onManageStopsClick={
            props.onManageStopsClick
              ? withClose(props.onManageStopsClick)
              : undefined
          }
          onSearchAlongRouteClick={withClose(props.onSearchAlongRouteClick)}
          onRoutePreviewClick={withClose(props.onRoutePreviewClick)}
          onRouteDirectionsClick={withClose(props.onRouteDirectionsClick)}
          onRouteEndClick={withClose(props.onRouteEndClick)}
        />
      </Box>
    </Card>
  );
};

const ExpandedControls = ({
  expanded,
  onManageStopsClick,
  onSearchAlongRouteClick,
  onRoutePreviewClick,
  onRouteDirectionsClick,
  onRouteEndClick,
}: {
  expanded: boolean;
  onManageStopsClick?: () => void;
  onSearchAlongRouteClick: () => void;
  onRoutePreviewClick: () => void;
  onRouteDirectionsClick: () => void;
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
        {onManageStopsClick && (
          <>
            <ListDivider />
            <ListItem>
              <ListItemButton onClick={onManageStopsClick}>
                <ListItemDecorator>
                  <EditLocationAlt sx={{ transform: 'scale(1.25)' }} />
                </ListItemDecorator>
                Manage Stops
              </ListItemButton>
            </ListItem>
          </>
        )}
        <ListDivider />
        <ListItem>
          <ListItemButton onClick={onSearchAlongRouteClick}>
            <ListItemDecorator>
              <Search sx={{ transform: 'scale(1.25)' }} />
            </ListItemDecorator>
            Search along route
          </ListItemButton>
        </ListItem>
        <ListDivider />
        <ListItem>
          <ListItemButton onClick={onRoutePreviewClick}>
            <ListItemDecorator>
              <AltRoute sx={{ transform: 'scale(1.25)' }} />
            </ListItemDecorator>
            Preview route
          </ListItemButton>
        </ListItem>
        <ListDivider />
        <ListItem>
          <ListItemButton onClick={onRouteDirectionsClick}>
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
