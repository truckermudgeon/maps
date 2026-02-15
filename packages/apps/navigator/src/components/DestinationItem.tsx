import {
  Box,
  ListDivider,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/joy';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type {
  SearchResult,
  SearchResultWithRelativeTruckInfo,
} from '@truckermudgeon/navigation/types';
import type { ReactElement } from 'react';
import { toCompassPoint } from '../base/to-compass-point';
import { SpriteImage } from './SpriteImage';
import { toLengthAndUnit, toLocationString } from './text';

export const DestinationItem = (props: {
  destination: SearchResultWithRelativeTruckInfo;
  index: number | undefined;
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
            {props.index != null && (
              <Box width={'1em'} mr={1}>
                <Typography fontSize={'lg'} textAlign={'right'}>
                  {props.index + 1}.
                </Typography>
              </Box>
            )}
            <Box
              sx={{
                width: 'calc(0.8 * 128px)',
              }}
            >
              <SpriteImage spriteName={toImgUrl(props.destination)} />
            </Box>
            <Stack flexDirection={'column'} flexGrow={1}>
              <Stack
                flexDirection={'row'}
                gap={1}
                justifyContent={'space-between'}
              >
                <Typography fontSize={'lg'}>
                  {props.destination.label}
                </Typography>
                <Stack direction={'row'} alignItems={'center'}>
                  {props.destination.facilityUrls.map(url => (
                    <SpriteImage key={url} spriteName={url} />
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
                  {toLocationString(props.destination)}
                </Typography>
                <Typography color={'neutral'} fontSize={'md'} flexGrow={0}>
                  {toLengthAndUnit(props.destination.distance).length}
                  <Typography fontSize={'xs'}>
                    {toLengthAndUnit(props.destination.distance).unit}
                  </Typography>
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

function toImgUrl(search: SearchResult): string {
  switch (search.type) {
    case 'city':
    case 'scenery':
      return `/icons/city_names_ico.png`;
    case 'company':
    case 'landmark':
    case 'viewpoint':
    case 'ferry':
    case 'train':
    case 'dealer':
    case 'serviceArea':
      return `/icons/${search.sprite}.png`;
    default:
      throw new UnreachableError(search);
  }
}
