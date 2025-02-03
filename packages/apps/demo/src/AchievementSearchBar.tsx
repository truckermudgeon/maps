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
  features: {
    coordinates: [number, number];
    dlcGuard: number;
  }[];
}

// The files ats-achievements.json and ets2-achievements.json can be created by
// visiting the SteamDB achievement stats page for each game and executing a JS
// command. The result is the `data` array in the AchievementsJson interface.
// ATS:  https://steamdb.info/app/270880/stats/
// ETS2: https://steamdb.info/app/227300/stats/
// $$('tr[id|=achievement]').map(tr=>{const[id,titleAndDesc,imgs]=$$('td',tr);const[title,desc]=titleAndDesc.textContent.trim().split('\\n\\n');return{id:id.textContent,title,desc,imgUrl:$('img',imgs).src}});

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
    const game = map === 'usa' ? 'ats' : 'ets2';
    Promise.all([
      fetch(`${game}-achievements.json`).then(
        r => r.json() as Promise<AchievementsJson>,
      ),
      fetch(`${game}-achievements.geojson`).then(
        r =>
          r.json() as Promise<
            GeoJSON.FeatureCollection<
              AchievementFeature['geometry'],
              AchievementFeature['properties']
            >
          >,
      ),
    ]).then(
      ([achievements, geoJson]) => {
        const features = new Map<
          string,
          { coordinates: [number, number]; dlcGuard: number }[]
        >();
        for (const f of geoJson.features) {
          putIfAbsent(f.properties.name, [], features).push({
            coordinates: f.geometry.coordinates as [number, number],
            dlcGuard: f.properties.dlcGuard,
          });
        }
        const geoNames = new Set<string>(
          geoJson.features.map(feature => feature.properties.name),
        );
        setAchievements([
          ...achievements.data
            .filter(a => geoNames.has(a.id))
            .map(a => ({
              ...a,
              label: a.title,
              value: a.id,
              features: assertExists(features.get(a.id)),
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ]);
      },
      () => console.error('could not load achievements json.'),
    );
  }, [map]);

  const options = achievements.filter(a => {
    if (map === 'europe') {
      // TODO add country filtering for europe
      return true;
    }
    const enabledDlcGuards = toAtsDlcGuards(props.visibleStateDlcs);
    return a.features.some(f =>
      enabledDlcGuards.has(f.dlcGuard as AtsDlcGuard),
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
        <AutocompleteOption {...props} key={option.value}>
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
