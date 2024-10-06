import { Stack } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { toRadians } from '@truckermudgeon/base/geom';
import type { StateCode } from '@truckermudgeon/ui';
import React, { useEffect, useRef, useState } from 'react';
import { useControl, useMap } from 'react-map-gl/maplibre';
import type { CityOption } from './CitySearchBar';
import { CitySearchBar } from './CitySearchBar';
import type { GameOption } from './SearchSelect';
import { SearchSelect, europeGameOption, usaGameOption } from './SearchSelect';

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

interface OmniBarSearchProps {
  visibleStates: Set<StateCode>;
}
export const OmniBar = (props: OmniBarSearchProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useControl(
    () => ({
      onAdd: () => assertExists(ref.current),
      onRemove: () => assertExists(ref.current).remove(),
    }),
    { position: 'top-left' },
  );

  const { current: map } = useMap();
  const initialMap: GameOption =
    localStorage.getItem('tm-map') === 'europe'
      ? europeGameOption
      : usaGameOption;
  const [gameMap, setGameMap] = useState<GameOption>(initialMap);
  const onMapSelect = React.useCallback(
    (option: GameOption) => {
      if (option == null) {
        return;
      }
      setGameMap(option);
      localStorage.setItem('tm-map', option.value);
      if (!map) {
        return;
      }

      const { longitude, latitude } = mapCenters[option.value];
      map.easeTo({
        zoom: 4,
        center: [longitude, latitude],
      });
    },
    [map],
  );

  useEffect(() => {
    if (!map) {
      return;
    }
    const setClosestMap = () => {
      const lng = map.getCenter().lng;
      const dUsa = delta(lng, mapCenters.usa.longitude);
      const dEurope = delta(lng, mapCenters.europe.longitude);
      if (dUsa < dEurope && gameMap.value !== 'usa') {
        setGameMap(usaGameOption);
        localStorage.setItem('tm-map', 'usa');
      } else if (dEurope < dUsa && gameMap.value !== 'europe') {
        setGameMap(europeGameOption);
        localStorage.setItem('tm-map', 'europe');
      }
    };
    map.on('moveend', setClosestMap);
    return () => void map.off('moveend', setClosestMap);
  }, [map, gameMap, setGameMap]);

  const onSearchBarSelect = React.useCallback(
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

  return (
    <div
      ref={ref}
      className={'maplibregl-ctrl'}
      style={{ width: 'calc(100svw - 64px)' }}
    >
      <Stack direction={'row'} gap={1}>
        <SearchSelect map={gameMap.value} onSelect={onMapSelect} />
        <CitySearchBar
          map={gameMap.value}
          onSelect={onSearchBarSelect}
          visibleStates={props.visibleStates}
        />
      </Stack>
    </div>
  );
};

function delta(lngA: number, lngB: number) {
  const a = toRadians(lngA) / 2;
  const b = toRadians(lngB) / 2;
  return Math.abs(Math.sin(a) - Math.sin(b));
}
