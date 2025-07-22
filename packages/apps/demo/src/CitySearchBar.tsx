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
  LabelMeta,
  ScopedCityFeature,
  ScopedCountryFeature,
} from '@truckermudgeon/map/types';
import {
  atsSceneryTownsUrl,
  ets2SceneryTownsUrl,
  type StateCode,
} from '@truckermudgeon/ui';
import type { GeoJSON } from 'geojson';
import type { ReactElement } from 'react';
import { Fragment, useEffect, useState } from 'react';

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

type LabelFC = GeoJSON.FeatureCollection<GeoJSON.Point, LabelMeta>;

type SearchBarProps = {
  selectDecorator: ReactElement;
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

export const CitySearchBar = (props: SearchBarProps) => {
  const { map, selectDecorator, onSelect } = props;
  const [sortedCities, setSortedCities] = useState<CityOption[]>([]);
  useEffect(() => {
    Promise.all([
      fetch('cities.geojson').then(r => r.json() as Promise<CityAndCountryFC>),
      fetch(atsSceneryTownsUrl).then(r => r.json() as Promise<LabelFC>),
      fetch(ets2SceneryTownsUrl).then(r => r.json() as Promise<CityFC>),
    ]).then(
      ([citiesAndCountries, atsLabels, etsTowns]) => {
        setSortedCities(
          createSortedCityOptions(citiesAndCountries, atsLabels, etsTowns),
        );
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
      placeholder={'Search cities...'}
      options={options}
      filterOptions={filterOptions}
      groupBy={option => option.state}
      blurOnSelect
      autoComplete
      renderGroup={formatGroupLabel}
      sx={{
        paddingInlineStart: 0,
        flexBasis: '28em',
      }}
      startDecorator={selectDecorator}
    />
  );
};

function formatGroupLabel(params: AutocompleteRenderGroupParams) {
  return (
    <Fragment key={params.key}>
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
    </Fragment>
  );
}

/** Sorts cities by state/country, then by city name. */
function createSortedCityOptions(
  citiesAndCountries: CityAndCountryFC,
  atsLabels: LabelFC,
  etsTowns: CityFC,
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
  for (const label of atsLabels.features) {
    if (
      label.properties.show === false || // don't skip labels with undefined `show`
      label.properties.kind === 'city' || // avoid duplicate labels
      label.properties.country == null ||
      label.properties.text == null
    ) {
      continue;
    }
    cities.push({
      type: 'Feature',
      geometry: label.geometry,
      properties: {
        type: 'city',
        map: 'usa',
        countryCode: label.properties.country.replace(/^..-/, ''),
        name: label.properties.text,
      },
    });
  }
  for (const town of etsTowns.features) {
    cities.push({
      type: 'Feature',
      geometry: town.geometry,
      properties: {
        type: 'city',
        map: 'europe',
        countryCode: town.properties.state,
        name: town.properties.name,
      },
    });
  }

  return cities
    .filter(city => countryCodeToName.has(city.properties.countryCode))
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
