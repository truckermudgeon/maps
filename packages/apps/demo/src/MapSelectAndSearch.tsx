import type { StateCode } from '@truckermudgeon/ui';
import React, { useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import type { GameOption } from './MapSelect';
import { MapSelect } from './MapSelect';
import type { CityOption } from './SearchBar';
import { SearchBar } from './SearchBar';

interface MapSelectAndSearchProps {
  visibleStates: Set<StateCode>;
}
export const MapSelectAndSearch = (props: MapSelectAndSearchProps) => {
  const { current: map } = useMap();
  const initialMap: GameOption =
    localStorage.getItem('tm-map') === 'europe'
      ? {
          label: 'ETS2',
          value: 'europe',
        }
      : {
          label: 'ATS',
          value: 'usa',
        };
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

      if (option.value === 'europe') {
        map.flyTo({
          curve: 1,
          zoom: 9,
          center: [8, 50],
        });
      } else {
        map.flyTo({
          curve: 1,
          zoom: 9,
          center: [-108, 40],
        });
      }
    },
    [map],
  );

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
    <>
      <MapSelect map={gameMap.value} onSelect={onMapSelect} />
      <SearchBar
        map={gameMap.value}
        onSelect={onSearchBarSelect}
        visibleStates={props.visibleStates}
      />
    </>
  );
};
