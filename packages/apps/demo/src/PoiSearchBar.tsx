import {
  Error as ErrorIcon,
  HomeOutlined,
  LocationCity,
  Pallet,
} from '@mui/icons-material';
import {
  Autocomplete,
  AutocompleteOption,
  Box,
  ListItemContent,
  ListItemDecorator,
  Tooltip,
  Typography,
} from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import type {
  AtsDlcGuard,
  AtsSelectableDlc,
} from '@truckermudgeon/map/constants';
import { toAtsDlcGuards } from '@truckermudgeon/map/constants';
import type { SearchProperties } from '@truckermudgeon/map/types';
import type { Expression, FuseSortFunctionArg } from 'fuse.js';
import Fuse from 'fuse.js';
import type { GeoJSON } from 'geojson';
import type { ReactElement } from 'react';
import { memo, useEffect, useState } from 'react';

export interface PoiOption {
  type: 'poi';
  label: string;
  id: string;
  poi: GeoJSON.Feature<GeoJSON.Point, SearchProperties>;
}

type SearchBarProps = {
  selectDecorator: ReactElement;
  onSelect: (option: PoiOption | null) => void;
} & (
  | {
      map: 'usa';
      visibleStateDlcs: Set<AtsSelectableDlc>;
    }
  | {
      map: 'europe';
    }
);

type SpritesJson = Record<
  string,
  { x: number; y: number; width: number; height: number }
>;

type SearchFuse = Fuse<GeoJSON.Feature<GeoJSON.Point, SearchProperties>>;
type PoiSearchOption =
  | PoiOption
  // TODO add support for multi-poi-returning suggested searches, e.g.:
  //  Wallbert - see all locations
  //  Viewpoints - see all locations
  | {
      type: 'suggestion';
      id: string;
      suggestion:
        | {
            type: 'allCompanyLocations';
            companyName: string;
            stateName?: string;
          }
        | {
            type: 'allTruckDealerLocations';
            dealerName: string;
            stateName?: string;
          }
        | {
            type: 'allViewpointLocations';
            stateName?: string;
          }
        | {
            type: 'allLandmarkLocations';
            stateName?: string;
          }
        | {
            type: 'allCitiesAndSceneryInState';
            stateName: string;
          };
    };

const maxResults = 100;

// This helper, and the code for multi-token searches using Fuse.js, from:
// https://stackoverflow.com/a/67736057
const tokenizeStringWithQuotesBySpaces = (string: string): string[] =>
  string.match(/("[^"]*?"|[^"\s]+)+(?=\s*|\s*$)/g) ?? [];

export const PoiSearchBar = (props: SearchBarProps) => {
  const { map, selectDecorator, onSelect } = props;
  const [sprites, setSprites] = useState<SpritesJson>({});
  const [search, setSearch] = useState<SearchFuse | null>(null);
  const [options, setOptions] = useState<readonly PoiSearchOption[]>([]);
  const [value, setValue] = useState<PoiOption | string | null>(null);
  const [numSearchResults, setNumSearchResults] = useState(0);
  // HACK call `setNumSearchResults` in a delay to hack around a React error
  // about setting state and triggering a nested `endDecorator` render, whilst
  // in the middle of rendering the `AutoComplete` component.
  const delayedSetNumSearchResults = (n: number) =>
    setTimeout(() => setNumSearchResults(n), 0);

  useEffect(() => {
    fetch('sprites@2x.json')
      .then(r => r.json() as Promise<SpritesJson>)
      .then(
        sprites => setSprites(sprites),
        e => console.error('could not load sprites json', e),
      );
  }, []);

  useEffect(() => {
    const game = map === 'usa' ? 'ats' : 'ets2';
    fetch(`${game}-search.geojson`)
      .then(
        r =>
          r.json() as Promise<
            GeoJSON.FeatureCollection<GeoJSON.Point, SearchProperties>
          >,
      )
      .then(
        geoJson => {
          let filterByDlc: (
            f: GeoJSON.Feature<GeoJSON.Point, SearchProperties>,
          ) => boolean;
          if (map === 'usa') {
            const enabledDlcGuards = toAtsDlcGuards(props.visibleStateDlcs);
            filterByDlc = f =>
              enabledDlcGuards.has(f.properties.dlcGuard as AtsDlcGuard);
          } else {
            // TODO update this when DLC toggling is enabled for ETS2.
            filterByDlc = () => true;
          }
          const enabledFeatures = geoJson.features.filter(filterByDlc);
          const searchFuse: SearchFuse = new Fuse(enabledFeatures, {
            distance: 0,
            threshold: 0.2,
            findAllMatches: true,
            ignoreLocation: true, // so that 'san francisco' can be searched for without quotes
            sortFn: sortSearchResults,
            keys: [
              { name: 'properties.label', weight: 3 },
              { name: 'properties.city.name', weight: 2 },
              { name: 'properties.stateName', weight: 1.5 },
              'properties.stateCode',
              'properties.tags',
            ],
          });
          setSearch(searchFuse);
          setOptions(
            enabledFeatures.map((res, i) => ({
              type: 'poi',
              id: i.toString(),
              label: res.properties.label,
              poi: res,
            })),
          );
        },
        e => console.error('could not load search json.', e),
      );
  }, [map, map === 'usa' ? props.visibleStateDlcs : null]);

  const filterOptions = (
    options: PoiSearchOption[],
    { inputValue }: { inputValue: string },
  ) => {
    Preconditions.checkState(search != null);
    if (inputValue.length < 3) {
      if (value != null) {
        if (typeof value === 'string') {
          inputValue = value;
        } else {
          inputValue = value.label;
        }
      } else {
        delayedSetNumSearchResults(0);
        return [];
      }
    }

    const tokenisedSearchQuery = tokenizeStringWithQuotesBySpaces(inputValue);
    if (!tokenisedSearchQuery.length) {
      console.warn('empty tokens for search input:', inputValue);
      delayedSetNumSearchResults(0);
      return [];
    }

    const hits = search.search({
      $and: tokenisedSearchQuery.map((searchToken: string) => {
        const orFields: Expression[] = [
          { 'properties.label': searchToken },
          { 'properties.city.name': searchToken },
          { 'properties.stateName': searchToken },
          { 'properties.stateCode': searchToken },
          { 'properties.tags': searchToken },
        ];
        return {
          $or: orFields,
        };
      }),
    });
    delayedSetNumSearchResults(hits.length);
    return hits.slice(0, maxResults).map(hit => options[hit.refIndex]);
  };

  return (
    <Autocomplete
      // Hacky way to clear the current selection when `map` prop changes.
      key={map}
      onChange={(_event, newValue) => {
        if (newValue == null) {
          setValue(null);
          onSelect(null);
        } else if (typeof newValue === 'string') {
          setValue(newValue);
        } else if (newValue && newValue.type === 'poi') {
          setNumSearchResults(1);
          setValue(newValue);
          onSelect(newValue);
        } else if (newValue) {
          throw new Error('suggestions not yet supported');
        }
      }}
      onInputChange={(_event, _value, reason) => {
        if (reason !== 'reset') {
          setValue(null);
        }
      }}
      placeholder={'Search cities, companies, points of interest...'}
      options={options}
      filterOptions={filterOptions}
      getOptionLabel={getOptionLabel}
      blurOnSelect
      handleHomeEndKeys
      freeSolo
      sx={{
        paddingInlineStart: 0,
        flexBasis: '28em',
      }}
      startDecorator={selectDecorator}
      endDecorator={
        <WarningDecorator
          maxResults={maxResults}
          numSearchResults={numSearchResults}
        />
      }
      renderOption={(props, option) => (
        <AutocompleteOption {...props} key={option.id}>
          <OptionContent option={option} sprites={sprites} />
        </AutocompleteOption>
      )}
    />
  );
};

const WarningDecorator = ({
  numSearchResults,
  maxResults,
}: {
  numSearchResults: number;
  maxResults: number;
}) => {
  return numSearchResults > maxResults ? (
    <Tooltip
      title={`Showing first ${maxResults} of ${numSearchResults} results, only. Try adding more terms to narrow your search.`}
    >
      <ErrorIcon color={'warning'} sx={{ width: '0.8em' }} />
    </Tooltip>
  ) : null;
};

const OptionContent = memo(
  ({ option, sprites }: { option: PoiSearchOption; sprites: SpritesJson }) => (
    <>
      <ListItemDecorator
        sx={{
          display: 'flex',
          justifyContent: 'center',
          mx: 0,
        }}
      >
        <Decorator option={option} sprites={sprites} />
      </ListItemDecorator>
      <Content option={option} />
      <ListItemDecorator>
        {option.type === 'poi' && option.poi.properties.type === 'company' ? (
          <Decorator option={option} sprites={sprites} position={'end'} />
        ) : null}
      </ListItemDecorator>
    </>
  ),
);

const Decorator = ({
  option,
  sprites,
  position,
}: {
  option: PoiSearchOption;
  sprites: SpritesJson;
  position?: 'end';
}) => {
  if (option.type === 'suggestion') {
    return null;
  }

  if (option.poi.properties.type === 'city') {
    return <LocationCity />;
  } else if (option.poi.properties.type === 'scenery') {
    return <HomeOutlined />;
  }

  let spriteName: string;
  switch (option.poi.properties.type) {
    case 'company':
      if (!position) {
        return <Pallet />;
      }
      spriteName = option.poi.properties.sprite;
      break;
    case 'landmark':
    case 'viewpoint':
    case 'dealer':
    case 'ferry':
    case 'train':
      spriteName = option.poi.properties.sprite;
      break;
    default:
      throw new UnreachableError(option.poi.properties.type);
  }
  const spriteEntry = assertExists(sprites[spriteName]);
  return (
    <Box
      sx={{
        width: spriteEntry.width + 'px',
        height: spriteEntry.height + 'px',
        background: `url(sprites.png) -${spriteEntry.x}px -${spriteEntry.y}px`,
        transform: 'scale(0.70)',
      }}
    />
  );
};

function getOptionLabel(option: string | PoiSearchOption): string {
  if (typeof option === 'string') {
    return option;
  } else if (option.type === 'suggestion') {
    return 'suggestion';
  }

  const meta = option.poi.properties;
  switch (meta.type) {
    case 'city':
    case 'scenery':
      return `${option.label}, ${meta.stateCode}`;
    case 'company':
    case 'landmark':
    case 'viewpoint':
    case 'dealer':
    case 'ferry':
    case 'train': {
      const location = classifyLocation(meta.label, meta.city);
      switch (location) {
        case LocationType.IN_CITY:
          return `${option.label} in ${meta.city.name}, ${meta.stateCode}`;
        case LocationType.NEAR_CITY:
          return `${option.label} near ${meta.city.name}, ${meta.stateCode}`;
        case LocationType.IN_STATE:
          return `${option.label} in ${meta.stateName}`;
        default:
          throw new UnreachableError(location);
      }
    }
    default:
      throw new UnreachableError(meta);
  }
}

const Content = ({ option }: { option: PoiSearchOption }) => {
  if (option.type === 'suggestion') {
    return 'suggestion';
  }
  const meta = option.poi.properties;

  switch (meta.type) {
    case 'city':
    case 'scenery':
      return (
        <ListItemContent>
          {option.label}, {meta.stateCode}
        </ListItemContent>
      );
    case 'company':
    case 'landmark':
    case 'viewpoint':
    case 'dealer':
    case 'ferry':
    case 'train': {
      let locationText: string;
      const location = classifyLocation(meta.label, meta.city);
      switch (location) {
        case LocationType.IN_CITY:
          locationText = `${meta.city.name}, ${meta.stateCode}`;
          break;
        case LocationType.NEAR_CITY:
          locationText = `near ${meta.city.name}, ${meta.stateCode}`;
          break;
        case LocationType.IN_STATE:
          locationText = `${meta.stateName}`;
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
      throw new UnreachableError(meta);
  }
};

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

const searchPropertyPriority: Record<SearchProperties['type'], number> = {
  company: 0,
  city: 1,
  scenery: 1,
  landmark: 2,
  viewpoint: 3,
  dealer: 4,
  ferry: 5,
  train: 6,
};

function sortSearchResults(
  a: FuseSortFunctionArg,
  b: FuseSortFunctionArg,
): number {
  if (a.score !== b.score) {
    return a.score - b.score;
  }

  // N.B.: the indices into `.item` are based on the `keys` option specified
  // when constructing the Fuse object.

  const aCity = a.item[1] as unknown as
    | {
        v: string;
      }
    | undefined;
  const bCity = b.item[1] as unknown as
    | {
        v: string;
      }
    | undefined;
  if (aCity && bCity) {
    return aCity.v.localeCompare(bCity.v);
  } else if (aCity && !bCity) {
    // `a` is a company/landmark/viewpoint/ferry/train/dealer
    // `b` is a city/scenery
    return 1;
  } else if (!aCity && bCity) {
    // `a` is a city/scenery
    // `b` is a company/landmark/viewpoint/ferry/train/dealer
    return -1;
  }

  const aTags = a.item[4];
  const bTags = b.item[4];
  if (!Array.isArray(aTags) || !Array.isArray(bTags)) {
    throw new Error('unexpected non-arrays at key 5');
  }

  const aType = assertExists(
    (aTags as unknown as { v: string; i: number }[]).find(t => t.i === 0),
  ).v as SearchProperties['type'];
  const bType = assertExists(
    (bTags as unknown as { v: string; i: number }[]).find(t => t.i === 0),
  ).v as SearchProperties['type'];
  if (aType !== bType) {
    return searchPropertyPriority[aType] - searchPropertyPriority[bType];
  }

  const aLabel = a.item[0] as unknown as { v: string };
  const bLabel = b.item[0] as unknown as { v: string };
  return aLabel.v.localeCompare(bLabel.v);
}
