import {
  Autocomplete,
  AutocompleteOption,
  createFilterOptions,
  ListItemContent,
  ListItemDecorator,
  Typography,
} from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { putIfAbsent } from '@truckermudgeon/base/map';
import type {
  AtsDlcGuard,
  AtsSelectableDlc,
} from '@truckermudgeon/map/constants';
import { toAtsDlcGuards } from '@truckermudgeon/map/constants';
import type { AchievementFeature } from '@truckermudgeon/map/types';
import { type StateCode } from '@truckermudgeon/ui';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

export interface AchievementOption {
  // achievement title
  label: string;
  // achievement id
  value: string;
  desc: string;
  imgUrl: string;
  map: 'usa' | 'europe';
  features: {
    coordinates: [number, number];
    dlcGuard: number;
  }[];
}

export interface AchievementsJson {
  data: {
    id: string;
    title: string;
    desc: string;
    imgUrl: string;
  }[];
}

type SearchBarProps = {
  selectDecorator: ReactElement;
  onSelect: (option: AchievementOption | null) => void;
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

export const AchievementSearchBar = (props: SearchBarProps) => {
  const { map, selectDecorator, onSelect } = props;
  const [achievements, setAchievements] = useState<AchievementOption[]>([]);
  useEffect(() => {
    Promise.all([
      fetch('ats-achievements.json').then(
        r => r.json() as Promise<AchievementsJson>,
      ),
      fetch('ats-achievements.geojson').then(
        r =>
          r.json() as Promise<
            GeoJSON.FeatureCollection<
              AchievementFeature['geometry'],
              AchievementFeature['properties']
            >
          >,
      ),
    ]).then(
      ([atsAchievements, atsGeoJson]) => {
        const features = new Map<
          string,
          { coordinates: [number, number]; dlcGuard: number }[]
        >();
        for (const f of atsGeoJson.features) {
          putIfAbsent(f.properties.name, [], features).push({
            coordinates: f.geometry.coordinates as [number, number],
            dlcGuard: f.properties.dlcGuard,
          });
        }
        const geoNames = new Set<string>(
          atsGeoJson.features.map(feature => feature.properties.name),
        );
        setAchievements([
          ...atsAchievements.data
            .filter(a => geoNames.has(a.id))
            .map(a => ({
              ...a,
              label: a.title,
              value: a.id,
              map: 'usa' as const,
              features: assertExists(features.get(a.id)),
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ]);
      },
      () => console.error('could not load achievements json.'),
    );
  }, []);

  const options = achievements.filter(a => {
    const mapMatches = a.map === map;
    if (map === 'europe') {
      // TODO add country filtering for europe
      return mapMatches;
    }
    const enabledDlcGuards = toAtsDlcGuards(props.visibleStateDlcs);
    return (
      mapMatches &&
      a.features.some(f => enabledDlcGuards.has(f.dlcGuard as AtsDlcGuard))
    );
  });

  const filterOptions = createFilterOptions<AchievementOption>({
    stringify: option => [option.label, option.desc].join(' '),
  });

  return (
    <Autocomplete
      // Hacky way to clear the current selection when `map` prop changes.
      key={map}
      onChange={(_, v) => onSelect(v)}
      placeholder={'Search achievements...'}
      options={options}
      filterOptions={filterOptions}
      blurOnSelect
      autoComplete
      sx={{
        paddingInlineStart: 0,
        flexBasis: '28em',
      }}
      startDecorator={selectDecorator}
      renderOption={(props, option) => (
        <AutocompleteOption {...props}>
          <ListItemDecorator
            sx={{
              border: '2px solid var(--joy-palette-neutral-outlinedBorder)',
              borderRadius: 6,
              overflow: 'hidden',
              minWidth: 'fit-content',
              mr: 0.5,
            }}
          >
            <img
              loading="lazy"
              width="48"
              height="48"
              src={option.imgUrl}
              alt=""
            />
          </ListItemDecorator>
          <ListItemContent>
            <Typography level={'title-md'}>{option.label}</Typography>
            <Typography level={'body-xs'}>{option.desc}</Typography>
          </ListItemContent>
        </AutocompleteOption>
      )}
    />
  );
};
