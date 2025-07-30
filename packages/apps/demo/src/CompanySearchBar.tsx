import { Autocomplete, createFilterOptions } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import type {
  AtsDlcGuard,
  AtsSelectableDlc,
} from '@truckermudgeon/map/constants';
import { toAtsDlcGuards } from '@truckermudgeon/map/constants';
import type { CompanyFeature } from '@truckermudgeon/map/types';
import groupBy from 'object.groupby';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

export interface CompanyOption {
  map: 'usa' | 'europe';
  label: string;
  spriteEntry: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
            > & {
              properties: { tokenLut: Record<string, string> };
            }
          >,
      ),
    ]).then(
      ([sprites, geoJson]) => {
        const tokenLut = new Map(Object.entries(geoJson.properties.tokenLut));
        const groupedCompanies = groupBy(geoJson.features, companyFeature =>
          assertExists(tokenLut.get(companyFeature.properties.token)),
        );
        const options: CompanyOption[] = [];
        for (const companies of Object.values(groupedCompanies)) {
          const first = companies[0].properties;
          if (first.map !== props.map) {
            continue;
          }
          const spriteEntry = sprites[first.token] ?? {
            height: 0,
            width: 0,
            x: 0,
            y: 0,
          };
          if (sprites[first.token] == null) {
            console.warn('no sprite for company token:', first.token);
          }

          options.push({
            label: tokenLut.get(first.token) ?? first.token,
            spriteEntry,
            map: first.map,
            features: companies.map(c => ({
              coordinates: c.geometry.coordinates as [number, number],
              dlcGuard: c.properties.dlcGuard,
            })),
          });
        }
        options.sort((a, b) => a.label.localeCompare(b.label));

        setCompanies(options);
      },
      err => console.error('could not load company data.', err),
    );
  }, [map]);

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
      blurOnSelect
      autoComplete
      sx={{
        paddingInlineStart: 0,
        flexBasis: '28em',
      }}
      startDecorator={selectDecorator}
    />
  );
};
