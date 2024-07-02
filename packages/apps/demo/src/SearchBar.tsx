import {
  Autocomplete,
  createFilterOptions,
  List,
  ListDivider,
  Typography,
} from '@mui/joy';
import type { AutocompleteRenderGroupParams } from '@mui/joy/Autocomplete/AutocompleteProps';
import { assertExists } from '@truckermudgeon/base/assert';
import type {
  ScopedCityFeature,
  ScopedCountryFeature,
} from '@truckermudgeon/map/types';
import { sceneryTownsUrl, type StateCode } from '@truckermudgeon/ui';
import type { GeoJSON } from 'geojson';
import { useEffect, useState } from 'react';

export interface CityOption {
  label: string;
  // long name (not post code). used to help filter
  // selection list by cities that match a state.
  state: string;
  // post code
  stateCode: string;
  map: 'usa' | 'europe';
  // lon-lat
  value: [number, number];
}

type CityAndCountryFC = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  ScopedCityFeature['properties'] | ScopedCountryFeature['properties']
>;

type CityFC = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  // state is two-letter code
  { state: string; name: string }
>;

type SearchBarProps = {
  onSelect: (option: CityOption) => void;
} & (
  | {
      map: 'usa';
      visibleStates: Set<StateCode>;
    }
  | {
      map: 'europe';
    }
);

export const SearchBar = (props: SearchBarProps) => {
  const { map, onSelect } = props;
  const [sortedCities, setSortedCities] = useState<CityOption[]>([]);
  useEffect(() => {
    Promise.all([
      fetch('cities.geojson').then(r => r.json() as Promise<CityAndCountryFC>),
      fetch(sceneryTownsUrl).then(r => r.json() as Promise<CityFC>),
    ]).then(
      ([citiesAndCountries, towns]) => {
        setSortedCities(createSortedCityOptions(citiesAndCountries, towns));
      },
      () => console.error('could not load cities/towns geojson.'),
    );
  }, []);

  const options = sortedCities.filter(city => {
    const mapMatches = city.map === map;
    if (map === 'europe') {
      // TODO add country filtering for europe
      return mapMatches;
    }
    return mapMatches && props.visibleStates.has(city.stateCode as StateCode);
  });

  const filterOptions = createFilterOptions<CityOption>({
    // stringify the state so that users can search for all cities in a state.
    stringify: option => [option.state, option.label].join(' '),
  });

  return (
    <Autocomplete
      // Hacky way to clear the current selection when `map` prop changes.
      key={map}
      onChange={(_, v) => v && onSelect(v)}
      placeholder={'Fly to...'}
      options={options}
      filterOptions={filterOptions}
      groupBy={option => option.state}
      blurOnSelect
      autoComplete
      renderGroup={formatGroupLabel}
    />
  );
};

function formatGroupLabel(params: AutocompleteRenderGroupParams) {
  return (
    <>
      <Typography
        m={1}
        level={'body-xs'}
        textTransform={'uppercase'}
        fontWeight={'lg'}
      >
        {params.group}
      </Typography>
      <List>{params.children}</List>
      <ListDivider />
    </>
  );
}

/** Sorts cities by state/country, then by city name. */
function createSortedCityOptions(
  citiesAndCountries: CityAndCountryFC,
  towns: CityFC,
): CityOption[] {
  const cities: ScopedCityFeature[] = [];
  const countryCodeToName = new Map<string, string>();
  for (const cityOrCountry of citiesAndCountries.features) {
    if (cityOrCountry.properties.type === 'city') {
      cities.push(cityOrCountry as ScopedCityFeature);
    } else if (cityOrCountry.properties.type === 'country') {
      countryCodeToName.set(
        cityOrCountry.properties.code,
        cityOrCountry.properties.name,
      );
    } else {
      throw new Error();
    }
  }
  for (const town of towns.features) {
    cities.push({
      type: 'Feature',
      geometry: town.geometry,
      properties: {
        type: 'city',
        map: 'usa',
        countryCode: town.properties.state,
        name: town.properties.name,
      },
    });
  }

  return cities
    .map(({ properties, geometry }) => ({
      map: properties.map,
      state: assertExists(countryCodeToName.get(properties.countryCode)),
      stateCode: properties.countryCode,
      label: properties.name,
      value: geometry.coordinates as [number, number],
    }))
    .sort((a, b) =>
      a.state !== b.state
        ? a.state.localeCompare(b.state)
        : a.label.localeCompare(b.label),
    );
}
