import {
  HomeOutlined,
  LocationCity,
  Pallet,
  Place,
  Search,
} from '@mui/icons-material';
import type { AutocompleteInputChangeReason } from '@mui/joy';
import {
  Autocomplete,
  AutocompleteOption,
  Button,
  Card,
  CircularProgress,
  Divider,
  ListItemContent,
  ListItemDecorator,
  Stack,
  Typography,
} from '@mui/joy';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import type { SearchResult } from '@truckermudgeon/navigation/types';
import { memo } from 'react';
import { DestinationTypes } from './DestinationTypes';
import { toLocationString } from './text';

export type ChooseDestinationPageMode = 'chooseDestination' | 'searchAlong';

export interface ChooseDestinationPageProps {
  mode: ChooseDestinationPageMode;
  showSearchLoading: boolean;
  onSelect: (value: string | SearchResult) => void;
  onInputChange: (value: string, reason: AutocompleteInputChangeReason) => void;
  onChooseOnMapClick: () => void;
  onDestinationTypeClick: (dest: PoiType, label: string) => void;
  options: SearchResult[];
}

const strings: Record<ChooseDestinationPageMode, { categoriesTitle: string }> =
  {
    chooseDestination: {
      categoriesTitle: 'Show nearby',
    },
    searchAlong: {
      categoriesTitle: 'Search along the way',
    },
  };

export const ChooseDestinationPage = (props: ChooseDestinationPageProps) => {
  return (
    <Stack direction={'column'} gap={2} flexGrow={1}>
      <Card size={'lg'} variant={'soft'}>
        <DestinationSearchBar
          loading={props.showSearchLoading}
          onSelect={props.onSelect}
          onInputChange={props.onInputChange}
          placeholderText={
            'Search companies, facilities, points of interest...'
          }
          options={props.options}
        />
        <Button
          size={'lg'}
          sx={{
            justifyContent: 'start',
            px: 2,
          }}
          startDecorator={<Place />}
          variant={'plain'}
          color={'neutral'}
          onClick={() => props.onChooseOnMapClick()}
        >
          Choose on map
        </Button>
      </Card>
      <Divider />
      <Typography level={'title-lg'}>
        {strings[props.mode].categoriesTitle}
      </Typography>
      <DestinationTypes onClick={props.onDestinationTypeClick} />
    </Stack>
  );
};

export interface DestinationSearchBarProps {
  loading: boolean;
  onSelect: (value: string | SearchResult) => void;
  onInputChange: (value: string, reason: AutocompleteInputChangeReason) => void;
  placeholderText: string;
  options: SearchResult[];
}

export const DestinationSearchBar = (props: DestinationSearchBarProps) => {
  return (
    <Autocomplete
      size={'lg'}
      placeholder={props.placeholderText}
      options={props.options}
      onChange={(_e, v, r) =>
        v != null &&
        (r == 'selectOption' || r === 'createOption') &&
        props.onSelect(v)
      }
      onInputChange={(_e, v, r) => props.onInputChange(v, r)}
      // N.B.: props.options is assumed to be pre-filtered.
      filterOptions={options => options}
      getOptionLabel={getOptionLabel}
      blurOnSelect
      handleHomeEndKeys
      freeSolo
      startDecorator={<Search />}
      endDecorator={
        props.loading ? (
          <CircularProgress size="sm" sx={{ bgcolor: 'background.surface' }} />
        ) : null
      }
      renderOption={(props, option) => (
        <AutocompleteOption {...props} key={option.nodeUid + option.type}>
          <OptionContent option={option} />
        </AutocompleteOption>
      )}
    />
  );
};

const OptionContent = memo(({ option }: { option: SearchResult }) => (
  <>
    <ListItemDecorator
      sx={{
        display: 'flex',
        justifyContent: 'center',
        mx: 0,
      }}
    >
      <Decorator option={option} />
    </ListItemDecorator>
    <Content option={option} />
    <ListItemDecorator>
      <Decorator option={option} position={'end'} />
    </ListItemDecorator>
  </>
));

const Decorator = ({
  option,
  position,
}: {
  option: SearchResult;
  position?: 'end';
}) => {
  // end decorator
  if (position === 'end') {
    if (option.type === 'company') {
      return <SpriteImage spriteName={option.sprite} includeMargin={true} />;
    } else if (
      option.type === 'serviceArea' &&
      isGasOrDealerBrandSprite(option.sprite)
    ) {
      return (
        <Stack direction={'row'} alignItems={'center'}>
          {option.facilityUrls.map(url => (
            <img
              src={url}
              key={url}
              style={{
                transformOrigin: '0 0',
                transform: 'scale(0.8)',
              }}
            />
          ))}
          <SpriteImage spriteName={option.sprite} includeMargin={true} />
        </Stack>
      );
    }
    return null;
  }

  // start decorator
  let spriteName: string;
  switch (option.type) {
    case 'city':
      return <LocationCity />;
    case 'scenery':
      return <HomeOutlined />;
    case 'company':
      return <Pallet />;
    case 'landmark':
    case 'viewpoint':
    case 'dealer':
    case 'ferry':
    case 'train':
      spriteName = option.sprite;
      break;
    case 'serviceArea': {
      // either:
      // - gas ico (based on label)
      // - dealer ico (based on label)
      // - garage, gas station, rest area
      // - unknown (fallback to first facility url)
      switch (option.label) {
        case 'Gallon Oil':
        case 'Phoenix':
        case 'Aron':
        case 'Vortex':
        case 'WP':
        case 'GreenPetrol':
        case 'Fusion':
        case 'Driverse':
        case 'Haulett':
          spriteName = 'gas_ico';
          break;
        case 'Western Star':
        case 'Kenworth':
        case 'Peterbilt':
        case 'Volvo':
        case 'Freightliner':
        case 'International':
        case 'Mack':
          spriteName = 'dealer_ico';
          break;
        case 'Garage':
          spriteName = 'garage_large_ico';
          break;
        case 'Gas Station':
          spriteName = 'gas_ico';
          break;
        case 'Rest Area':
          spriteName = 'parking_ico';
          break;
        default:
          spriteName = option.facilityUrls[0] ?? 'unknown';
          break;
      }
      break;
    }
    default:
      throw new UnreachableError(option);
  }
  return <SpriteImage spriteName={spriteName} />;
};

const SpriteImage = ({
  spriteName,
  includeMargin,
}: {
  spriteName: string;
  includeMargin?: true;
}) => (
  <div>
    <img
      src={`/icons/${spriteName}.png`}
      alt={spriteName}
      style={{
        padding: 0,
        margin: 0,
        transform: 'scale(0.8)',
        marginRight: includeMargin ? '1em' : undefined,
      }}
    />
  </div>
);

const enum LocationType {
  IN_CITY,
  NEAR_CITY,
  IN_STATE,
}

function classifyLocation(
  name: string,
  nearestCity: { name: string; stateCode: string; distance: number },
): LocationType {
  if (
    nearestCity.distance <= 250 ||
    name.startsWith(nearestCity.name) ||
    name.endsWith(nearestCity.name)
  ) {
    return LocationType.IN_CITY;
  } else if (nearestCity.distance <= 1000) {
    return LocationType.NEAR_CITY;
  } else {
    return LocationType.IN_STATE;
  }
}

const Content = ({ option }: { option: SearchResult }) => {
  switch (option.type) {
    case 'city':
    case 'scenery':
      return (
        <ListItemContent>
          {option.label}, {option.stateCode}
        </ListItemContent>
      );
    case 'company':
    case 'landmark':
    case 'viewpoint':
    case 'dealer':
    case 'ferry':
    case 'train':
    case 'serviceArea': {
      let locationText: string;
      const location = classifyLocation(option.label, option.city);
      switch (location) {
        case LocationType.IN_CITY:
          locationText = `${option.city.name}, ${option.stateCode}`;
          break;
        case LocationType.NEAR_CITY:
          locationText = `near ${option.city.name}, ${option.stateCode}`;
          break;
        case LocationType.IN_STATE:
          locationText = `${option.stateName}`;
          break;
        default:
          throw new UnreachableError(location);
      }
      return (
        <ListItemContent>
          <Typography>{option.label}</Typography>
          <Typography level={'body-sm'}>{locationText}</Typography>
        </ListItemContent>
      );
    }
    default:
      throw new UnreachableError(option);
  }
};

function getOptionLabel(option: string | SearchResult): string {
  if (typeof option === 'string') {
    return option;
  }

  const locationString = toLocationString(option);
  if (option.type === 'city' || option.type === 'scenery') {
    return locationString;
  }

  return [option.label, toLocationString(option)].join(' ');
}

function isGasOrDealerBrandSprite(sprite: string): boolean {
  return sprite.endsWith('_oil_gst') || sprite.endsWith('_dlr');
}
