import { assert, assertExists } from '@truckermudgeon/base/assert';
import { putIfAbsent } from '@truckermudgeon/base/map';
import type {
  ScopedCityFeature,
  ScopedCountryFeature,
} from '@truckermudgeon/map/types';
import { sceneryTownsUrl } from '@truckermudgeon/ui';
import type { GeoJSON } from 'geojson';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import type { SingleValue } from 'react-select';
import Select from 'react-select';
import type { FilterOptionOption } from 'react-select/dist/declarations/src/filters';

const groupStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const groupBadgeStyles: CSSProperties = {
  backgroundColor: '#EBECF0',
  borderRadius: '2em',
  color: '#172B4D',
  display: 'inline-block',
  fontSize: 12,
  fontWeight: 'normal',
  lineHeight: '1',
  minWidth: 1,
  padding: '0.166em 0.5em',
  textAlign: 'center',
};

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
  onSelect: (option: SingleValue<CityOption>) => void;
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

  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

  const filterOptions = (
    { label, data }: FilterOptionOption<CityOption>,
    input: string,
  ) => {
    if (data.map !== map) {
      return false;
    }
    label = normalize(label);
    input = normalize(input);
    if (label.split(' ').some(word => word.startsWith(input))) {
      return true;
    }

    const groupOptions = citiesByState.filter(group =>
      normalize(group.label)
        .split(' ')
        .some(word => word.startsWith(input)),
    );
    for (const groupOption of groupOptions) {
      const option = groupOption.options.find(opt => opt.state === data.state);
      if (option) {
        return true;
      }
    }
    return false;
  };

  return (
    <div
      style={{
        width: 250,
        margin: 10,
        marginLeft: 0,
        display: 'inline-block',
      }}
    >
      <Select<CityOption, false, GroupedCityOption>
        // Hacky way to clear the current selection when `map` prop changes.
        key={map}
        options={citiesByState}
        formatGroupLabel={formatGroupLabel}
        onChange={onSelect}
        filterOption={filterOptions}
        placeholder={'Fly to a city...'}
      />
    </div>
  );
};

function formatGroupLabel(group: GroupedCityOption) {
  return (
    <div style={groupStyles}>
      <span>{group.label}</span>
      <span style={groupBadgeStyles}>{group.options.length}</span>
    </div>
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
