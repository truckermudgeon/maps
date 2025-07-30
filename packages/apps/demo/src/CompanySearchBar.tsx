import {
  Autocomplete,
  createFilterOptions,
  List,
  ListDivider,
  Typography,
} from '@mui/joy';
import type { AutocompleteRenderGroupParams } from '@mui/joy/Autocomplete/AutocompleteProps';
import type {
  AtsDlcGuard,
  AtsSelectableDlc,
} from '@truckermudgeon/map/constants';
import { toAtsDlcGuards } from '@truckermudgeon/map/constants';
import type { CompanyFeature } from '@truckermudgeon/map/types';
import { type StateCode } from '@truckermudgeon/ui';
import type { ReactElement } from 'react';
import { Fragment, useEffect, useState } from 'react';

export interface CompanyOption {
  label: string;
  company: string;
  map: 'usa' | 'europe';
  city: string;
  country: string;
  features: {
    coordinates: [number, number];
    dlcGuard: number;
  }[];
}

type SearchBarProps = {
  selectDecorator: ReactElement;
  onSelect: (option: CompanyOption | null) => void;
} & (
  | {
      map: 'usa';
      visibleStates: Set<StateCode>;
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

export const CompanySearchBar = (props: SearchBarProps) => {
  const { map, selectDecorator, onSelect } = props;
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  useEffect(() => {
    Promise.all([
      fetch('sprites.json').then(r => r.json() as Promise<SpritesJson>),
      fetch('companies.geojson').then(
        r =>
          r.json() as Promise<
            GeoJSON.FeatureCollection<
              CompanyFeature['geometry'],
              CompanyFeature['properties']
            >
          >,
      ),
    ]).then(
      ([_sprites, geoJson]) => {
        setCompanies(
          geoJson.features
            .map(f => ({
              label: `${f.properties.token}-${f.properties.cityToken}`,
              company: f.properties.token,
              map: f.properties.map,
              city: f.properties.cityToken,
              country: f.properties.countryCode,
              features: [
                {
                  coordinates: f.geometry.coordinates as [number, number],
                  dlcGuard: f.properties.dlcGuard,
                },
              ],
            }))
            .sort((a, b) => {
              if (a.company !== b.company) {
                return a.company.localeCompare(b.company);
              }
              if (a.map !== b.map) {
                return a.map.localeCompare(b.map);
              }
              if (a.country !== b.country) {
                return a.country.localeCompare(b.country);
              }
              //if (a.city !== b.city) {
              return a.city.localeCompare(b.city);
              //}
            }),
        );
      },
      err => console.error('could not load company data.', err),
    );
  }, [map]);

  console.log('filtering companies...');
  const options = companies.filter(c => {
    const mapMatches = c.map === map;
    if (map === 'europe') {
      // TODO add country filtering for europe
      return true;
    }
    const enabledDlcGuards = toAtsDlcGuards(props.visibleStateDlcs);
    return (
      mapMatches &&
      c.features.some(f => enabledDlcGuards.has(f.dlcGuard as AtsDlcGuard))
    );
  });

  const filterOptions = createFilterOptions<CompanyOption>({
    stringify: option => option.label,
  });

  return (
    <Autocomplete
      // Hacky way to clear the current selection when `map` prop changes.
      key={map}
      onChange={(_, v) => onSelect(v)}
      placeholder={'Search companies...'}
      options={options}
      filterOptions={filterOptions}
      groupBy={option => option.company}
      clearOnBlur={false}
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
