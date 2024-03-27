import {
  Autocomplete,
  createFilterOptions,
  List,
  ListDivider,
  Typography,
} from '@mui/joy';
import type { AutocompleteRenderGroupParams } from '@mui/joy/Autocomplete/AutocompleteProps';
import { assert, assertExists } from '@truckermudgeon/base/assert';
import { putIfAbsent } from '@truckermudgeon/base/map';
import type {
  ScopedCityFeature,
  ScopedCountryFeature,
} from '@truckermudgeon/map/types';
import { sceneryTownsUrl } from '@truckermudgeon/ui';
import type { GeoJSON } from 'geojson';
import { useEffect, useState } from 'react';

export interface CityOption {
  label: string;
  // long name (not post code). used to help filter
  // selection list by cities that match a state.
  state: string;
  map: 'usa' | 'europe';
  // lon-lat
  value: [number, number];
}

interface GroupedCityOption {
  // state long name (not post code)
  label: string;
  map: 'usa' | 'europe';
  options: CityOption[];
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

interface SearchBarProps {
  map: 'usa' | 'europe';
  onSelect: (option: CityOption) => void;
}

export const SearchBar = ({ map, onSelect }: SearchBarProps) => {
  const [citiesByState, setCitiesByState] = useState<GroupedCityOption[]>([]);
  useEffect(() => {
    Promise.all([
      fetch('cities.geojson').then(r => r.json() as Promise<CityAndCountryFC>),
      fetch(sceneryTownsUrl).then(r => r.json() as Promise<CityFC>),
    ]).then(
      ([citiesAndCountries, towns]) => {
        setCitiesByState(createGroupedCityOptions(citiesAndCountries, towns));
      },
      () => console.error('could not load cities/towns geojson.'),
    );
  }, []);

  const options = citiesByState
    .filter(group => group.map === map)
    .reduce<CityOption[]>((acc, group) => {
      acc.push(...group.options);
      return acc;
    }, []);

  const filterOptions = createFilterOptions<CityOption>({
    // stringify the state so that users can search for all cities in a state.
    stringify: option => [option.state, option.label].join(' '),
  });

  return (
    <div
      style={{
        width: 250,
        margin: 10,
        marginLeft: 0,
        display: 'inline-block',
      }}
    >
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
    </div>
  );
};

function formatGroupLabel(params: AutocompleteRenderGroupParams) {
  return (
    <>
      <Typography m={1} level={'body-xs'} textTransform={'uppercase'}>
        {params.group}
      </Typography>
      <List>{params.children}</List>
      <ListDivider />
    </>
  );
}

function createGroupedCityOptions(
  citiesAndCountries: CityAndCountryFC,
  towns: CityFC,
): GroupedCityOption[] {
  const citiesByCountryCode = new Map<string, ScopedCityFeature[]>();
  const countries: ScopedCountryFeature['properties'][] = [];
  for (const cityOrCountry of citiesAndCountries.features) {
    if (cityOrCountry.properties.type === 'city') {
      const cities = putIfAbsent(
        cityOrCountry.properties.countryCode,
        [],
        citiesByCountryCode,
      );
      cities.push(cityOrCountry as ScopedCityFeature);
    } else if (cityOrCountry.properties.type === 'country') {
      countries.push(cityOrCountry.properties);
    } else {
      throw new Error();
    }
  }
  for (const town of towns.features) {
    const cities = putIfAbsent(town.properties.state, [], citiesByCountryCode);
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

  const sortedCountries = countries.sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return sortedCountries
    .filter(country => {
      // Some countries may be present in GeoJSON, but are never referenced by any
      // cities in the GeoJSON, for whatever reason (e.g., the Winterland cities).
      // Filter them out so no empty Groups are shown.
      return citiesByCountryCode.has(country.code);
    })
    .map(country => {
      const sortedCities = assertExists(citiesByCountryCode.get(country.code))
        .sort(({ properties: a }, { properties: b }) =>
          a.name.localeCompare(b.name),
        )
        .map(cf => ({
          map: country.map,
          state: country.name,
          label: cf.properties.name,
          value: cf.geometry.coordinates as [number, number],
        }));
      // sanity check
      assert(sortedCities.every(city => city.map === country.map));
      return {
        map: country.map,
        label: country.name,
        options: sortedCities,
      };
    });
}
