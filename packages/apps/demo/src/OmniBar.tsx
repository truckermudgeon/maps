import { Stack } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { getExtent, toRadians } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import type {
  AtsDlcGuard,
  AtsSelectableDlc,
} from '@truckermudgeon/map/constants';
import { toAtsDlcGuards } from '@truckermudgeon/map/constants';
import type { StateCode } from '@truckermudgeon/ui';
import { Marker } from 'maplibre-gl';
import React, { useEffect, useRef, useState } from 'react';
import { useControl, useMap } from 'react-map-gl/maplibre';
import type { AchievementOption } from './AchievementSearchBar';
import { AchievementSearchBar } from './AchievementSearchBar';
import type { CityOption } from './CitySearchBar';
import { CitySearchBar } from './CitySearchBar';
import type { CompanyOption } from './CompanySearchBar';
import { CompanySearchBar } from './CompanySearchBar';
import type { SearchOption, SearchTypes } from './SearchSelect';
import { getSearchOption, SearchSelect } from './SearchSelect';

export const mapCenters = {
  usa: {
    longitude: -108,
    latitude: 39,
  },
  europe: {
    longitude: 12,
    latitude: 51,
  },
};

interface OmniBarProps {
  visibleStates: Set<StateCode>;
  visibleStateDlcs: Set<AtsSelectableDlc>;
}
export const OmniBar = (props: OmniBarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useControl(
    () => ({
      onAdd: () => assertExists(ref.current),
      onRemove: () => assertExists(ref.current).remove(),
    }),
    { position: 'top-left' },
  );

  const { current: map } = useMap();
  const [gameMap, setGameMap] = useState<SearchOption>(
    getSearchOption(
      localStorage.getItem('tm-map') === 'europe' ? 'europe' : 'usa',
      toSearchOption(localStorage.getItem('tm-search')),
    ),
  );
  const onMapSelect = React.useCallback(
    (option: SearchOption) => {
      if (option == null) {
        return;
      }

      setGameMap(option);
      localStorage.setItem('tm-map', option.value.map);
      localStorage.setItem('tm-search', option.value.search);
      if (!map || option.value.map === gameMap.value.map) {
        return;
      }

      const { longitude, latitude } = mapCenters[option.value.map];
      map.easeTo({
        zoom: 4,
        center: [longitude, latitude],
      });
    },
    [map, gameMap],
  );

  useEffect(() => {
    if (!map) {
      return;
    }
    const setClosestMap = () => {
      const lng = map.getCenter().lng;
      const dUsa = delta(lng, mapCenters.usa.longitude);
      const dEurope = delta(lng, mapCenters.europe.longitude);
      if (dUsa < dEurope && gameMap.value.map !== 'usa') {
        setGameMap(getSearchOption('usa', gameMap.value.search));
        localStorage.setItem('tm-map', 'usa');
      } else if (dEurope < dUsa && gameMap.value.map !== 'europe') {
        setGameMap(getSearchOption('europe', gameMap.value.search));
        localStorage.setItem('tm-map', 'europe');
      }
    };
    map.on('moveend', setClosestMap);
    return () => void map.off('moveend', setClosestMap);
  }, [map, gameMap, setGameMap]);

  const onCitySelect = React.useCallback(
    (option: CityOption) => {
      if (map == null || option == null) {
        return;
      }

      map.flyTo({
        curve: 1,
        zoom: 9,
        center: option.value.map(v => Number(v.toFixed(3))) as [number, number],
      });
      void map.once('moveend', e => {
        const { lat, lng } = e.target.getCenter();
        const zoom = e.target.getZoom();
        const bearing = Number(e.target.getBearing().toFixed(1));
        const pitch = Math.round(e.target.getPitch());
        if (pitch) {
          window.location.hash = `${zoom}/${lat.toFixed(3)}/${lng.toFixed(
            3,
          )}/${bearing}/${pitch}`;
        } else if (bearing) {
          window.location.hash = `${zoom}/${lat.toFixed(3)}/${lng.toFixed(
            3,
          )}/${bearing}`;
        } else {
          window.location.hash = `${zoom}/${lat.toFixed(3)}/${lng.toFixed(3)}`;
        }
      });
    },
    [map],
  );

  const [markers, setMarkers] = useState<Marker[]>([]);
  const [achievementOption, setAchievementOption] =
    useState<AchievementOption | null>(null);
  const onAchievementSelect = React.useCallback(
    (
      option: AchievementOption | null,
      options: { enableFitBounds: boolean } = { enableFitBounds: true },
    ) => {
      markers.forEach(marker => marker.remove());
      setAchievementOption(option);
      if (map == null || option == null) {
        return;
      }

      // add markers for all points
      const enabledDlcGuards = toAtsDlcGuards(props.visibleStateDlcs);
      const newMarkers = option.features
        .filter(f => enabledDlcGuards.has(f.dlcGuard as AtsDlcGuard))
        .map(({ coordinates }) =>
          new Marker().setLngLat(coordinates).addTo(map.getMap()),
        );
      setMarkers(newMarkers);
      if (newMarkers.length && options.enableFitBounds) {
        const extent = getExtent(newMarkers.map(m => m.getLngLat().toArray()));
        const sw = [extent[0], extent[1]] as [number, number];
        const ne = [extent[2], extent[3]] as [number, number];
        map.fitBounds([sw, ne], { curve: 1, padding: 100, maxZoom: 9 });
      }
    },
    [map, markers, setAchievementOption, setMarkers, props.visibleStates],
  );

  useEffect(() => {
    onAchievementSelect(achievementOption, { enableFitBounds: false });
  }, [achievementOption, props.visibleStates]);

  const [companyOption, setCompanyOption] = useState<CompanyOption | null>(
    null,
  );
  const onCompanySelect = React.useCallback(
    (
      option: CompanyOption | null,
      options: { enableFitBounds: boolean } = { enableFitBounds: true },
    ) => {
      markers.forEach(marker => marker.remove());
      console.log('onCompanySelect', option);
      setCompanyOption(option);
      if (map == null || option == null) {
        return;
      }

      // add markers for all points
      const enabledDlcGuards = toAtsDlcGuards(props.visibleStateDlcs);
      const newMarkers = option.features
        .filter(f => enabledDlcGuards.has(f.dlcGuard as AtsDlcGuard))
        .map(({ coordinates }) =>
          new Marker().setLngLat(coordinates).addTo(map.getMap()),
        );
      setMarkers(newMarkers);
      if (newMarkers.length && options.enableFitBounds) {
        const extent = getExtent(newMarkers.map(m => m.getLngLat().toArray()));
        const sw = [extent[0], extent[1]] as [number, number];
        const ne = [extent[2], extent[3]] as [number, number];
        map.fitBounds([sw, ne], { curve: 1, padding: 100, maxZoom: 9 });
      }
    },
    [map, markers, setCompanyOption, setMarkers, props.visibleStateDlcs],
  );

  useEffect(() => {
    onCompanySelect(companyOption, { enableFitBounds: false });
  }, [companyOption, props.visibleStateDlcs]);

  const SearchBar = ({ selected }: { selected: SearchOption['value'] }) => {
    console.log('render searchbar');
    switch (selected.search) {
      case 'cities':
        return (
          <CitySearchBar
            selectDecorator={
              <SearchSelect selected={selected} onSelect={onMapSelect} />
            }
            map={selected.map}
            onSelect={onCitySelect}
            visibleStates={props.visibleStates}
          />
        );
      case 'companies':
        return (
          <CompanySearchBar
            selectDecorator={
              <SearchSelect selected={selected} onSelect={onMapSelect} />
            }
            map={selected.map}
            onSelect={onCompanySelect}
            visibleStateDlcs={props.visibleStateDlcs}
          />
        );
      case 'achievements':
        return (
          <AchievementSearchBar
            selectDecorator={
              <SearchSelect selected={selected} onSelect={onMapSelect} />
            }
            map={selected.map}
            onSelect={onAchievementSelect}
            visibleStates={props.visibleStates}
            visibleStateDlcs={props.visibleStateDlcs}
          />
        );
      default:
        throw new UnreachableError(selected.search);
    }
  };

  return (
    <div
      ref={ref}
      className={'maplibregl-ctrl'}
      style={{ width: 'calc(100svw - 64px)' }}
    >
      <Stack direction={'row'} gap={1}>
        <SearchBar selected={gameMap.value} />
      </Stack>
    </div>
  );
};

function toSearchOption(maybeString: string | null): SearchTypes {
  if (
    maybeString === 'achievements' ||
    maybeString === 'cities' ||
    maybeString === 'companies'
  ) {
    return maybeString;
  }
  return 'cities';
}

function delta(lngA: number, lngB: number) {
  const a = toRadians(lngA) / 2;
  const b = toRadians(lngB) / 2;
  return Math.abs(Math.sin(a) - Math.sin(b));
}
