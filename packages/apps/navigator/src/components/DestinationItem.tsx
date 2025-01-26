import {
  Box,
  ListDivider,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/joy';
import type { SearchResult } from '@truckermudgeon/navigation/types';
import type { ReactElement } from 'react';
import { toCompassPoint } from '../base/to-compass-point';

export const DestinationItem = (props: {
  destination: SearchResult;
  index: number;
  onDestinationHighlight: () => void;
  CollapsibleButtonBar: () => ReactElement;
}) => {
  return (
    <>
      <ListItem>
        <ListItemButton
          onClick={props.onDestinationHighlight}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            alignItems: 'normal',
          }}
        >
          <Stack direction={'row'} gap={1}>
            <Box width={'1em'} mr={1}>
              <Typography fontSize={'lg'} textAlign={'right'}>
                {props.index + 1}.
              </Typography>
            </Box>
            <Box marginTop={0.5}>
              <img src={props.destination.logoUrl} style={{ width: '4rem' }} />
            </Box>
            <Stack flexDirection={'column'} flexGrow={1}>
              <Stack
                flexDirection={'row'}
                gap={1}
                justifyContent={'space-between'}
              >
                <Typography fontSize={'lg'}>
                  {props.destination.name}
                </Typography>
                <Stack direction={'row'} alignItems={'center'} gap={0.5}>
                  {props.destination.facilityUrls.map(url => (
                    <img src={url} key={url} style={{ width: '1.5rem' }} />
                  ))}
                </Stack>
              </Stack>
              <Stack flexDirection={'row'} gap={1} alignItems={'baseline'}>
                <Typography
                  noWrap
                  color={'neutral'}
                  fontSize={'sm'}
                  flexGrow={1}
                  width={100}
                >
                  {props.destination.isCityStateApproximate ? 'Near ' : ''}
                  {props.destination.city}, {props.destination.state}
                </Typography>
                <Typography color={'neutral'} fontSize={'md'} flexGrow={0}>
                  {Number(
                    (props.destination.distanceMeters / 1609.344).toFixed(1),
                  ).toLocaleString()}
                  <Typography fontSize={'xs'}>mi</Typography>
                </Typography>
                <Typography
                  color={'neutral'}
                  fontSize={'md'}
                  fontWeight={'bold'}
                  flex={'0 1 2em'}
                  textAlign={'center'}
                >
                  {toCompassPoint(props.destination.bearing)}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
          <props.CollapsibleButtonBar />
        </ListItemButton>
      </ListItem>
      <ListDivider />
    </>
  );
};
