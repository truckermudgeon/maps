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
import type { PoiOption } from './PoiSearchBar';
import { PoiSearchBar } from './PoiSearchBar';
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

  const onPlaceSelect = React.useCallback(
    (option: PoiOption | null) => {
      if (map == null || option == null) {
        return;
      }

      map.flyTo({
        curve: 1,
        zoom: 10.5,
        center: option.poi.geometry.coordinates as [number, number],
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
  const createMarkersOnOptionCallback = <
    T extends {
      features: { coordinates: [number, number]; dlcGuard: number }[];
    },
  >(
    setOption: React.Dispatch<React.SetStateAction<T | null>>,
  ) =>
    React.useCallback(
      (
        option: T | null,
        options: { enableFitBounds: boolean } = { enableFitBounds: true },
      ) => {
        markers.forEach(marker => marker.remove());
        setOption(option);
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
          const extent = getExtent(
            newMarkers.map(m => m.getLngLat().toArray()),
          );
          const sw = [extent[0], extent[1]] as [number, number];
          const ne = [extent[2], extent[3]] as [number, number];
          map.fitBounds([sw, ne], { curve: 1, padding: 100, maxZoom: 9 });
        }
      },
      [map, markers, setOption, setMarkers, props.visibleStateDlcs],
    );

  const [achievementOption, setAchievementOption] =
    useState<AchievementOption | null>(null);
  const onAchievementSelect =
    createMarkersOnOptionCallback(setAchievementOption);
  useEffect(() => {
    onAchievementSelect(achievementOption, { enableFitBounds: false });
  }, [achievementOption, props.visibleStateDlcs]);

  return (
    <div
      ref={ref}
      className={'maplibregl-ctrl'}
      style={{ width: 'calc(100svw - 64px)' }}
    >
      <Stack direction={'row'} gap={1}>
        <SearchBar
          selected={gameMap.value}
          onMapSelect={onMapSelect}
          onPlaceSelect={onPlaceSelect}
          onAchievementSelect={onAchievementSelect}
          visibleStates={props.visibleStates}
          visibleStateDlcs={props.visibleStateDlcs}
        />
      </Stack>
    </div>
  );
};

const SearchBar = ({
  selected,
  onMapSelect,
  onPlaceSelect,
  onAchievementSelect,
  visibleStateDlcs,
}: {
  selected: SearchOption['value'];
  onMapSelect: (option: SearchOption) => void;
  onPlaceSelect: (option: PoiOption | null) => void;
  onAchievementSelect: (option: AchievementOption | null) => void;
  visibleStates: Set<StateCode>;
  visibleStateDlcs: Set<AtsSelectableDlc>;
}) => {
  switch (selected.map) {
    case 'usa':
      switch (selected.search) {
        case 'places':
          return (
            <PoiSearchBar
              selectDecorator={
                <SearchSelect selected={selected} onSelect={onMapSelect} />
              }
              map={selected.map}
              onSelect={onPlaceSelect}
              visibleStateDlcs={visibleStateDlcs}
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
              visibleStateDlcs={visibleStateDlcs}
            />
          );
        default:
          throw new UnreachableError(selected.search);
      }
    case 'europe':
      switch (selected.search) {
        case 'places':
          return (
            <PoiSearchBar
              selectDecorator={
                <SearchSelect selected={selected} onSelect={onMapSelect} />
              }
              map={selected.map}
              onSelect={onPlaceSelect}
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
            />
          );
        default:
          throw new UnreachableError(selected.search);
      }
  }
};

function toSearchOption(maybeString: string | null): SearchTypes {
  if (maybeString === 'achievements') {
    return maybeString;
  }
  return 'places';
}

function delta(lngA: number, lngB: number) {
  const a = toRadians(lngA) / 2;
  const b = toRadians(lngB) / 2;
  return Math.abs(Math.sin(a) - Math.sin(b));
}
