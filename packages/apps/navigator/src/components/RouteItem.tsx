import {
  Button,
  ListDivider,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/joy';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { Mode } from '@truckermudgeon/map/routing';
import type { Route } from '@truckermudgeon/navigation/types';

export const RouteItem = (props: {
  route: Route;
  onRouteHighlight: () => void;
  onRouteGoClick: () => void;
}) => {
  return (
    <>
      <ListItem>
        <ListItemButton onClick={props.onRouteHighlight} sx={{ gap: 1 }}>
          <Stack direction={'column'} flexGrow={1}>
            <Typography fontSize={'lg'}>12 hours, 34 minutes</Typography>
            <Typography color={'neutral'} fontSize={'sm'}>
              {(500 + Math.round(Math.random() * 1000)).toLocaleString()} miles
              &middot; {toModeString(props.route.segments[0].strategy)}
            </Typography>
          </Stack>
          <Button
            size={'lg'}
            variant={'solid'}
            color={'success'}
            onClick={e => {
              props.onRouteGoClick();
              e.stopPropagation();
            }}
          >
            Go!
          </Button>
        </ListItemButton>
      </ListItem>
      <ListDivider />
    </>
  );
};

function toModeString(mode: Mode) {
  switch (mode) {
    case 'fastest':
      return 'Fastest';
    case 'shortest':
      return 'Shortest';
    case 'smallRoads':
      return 'Prefer small roads';
    default:
      throw new UnreachableError(mode);
  }
}
