import { UnreachableError } from '@truckermudgeon/base/precon';
import type { AtsSelectableDlc } from '@truckermudgeon/map/constants';
import { AtsDlc, AtsSelectableDlcs } from '@truckermudgeon/map/constants';
import {
  BaseMapStyle,
  GameMapStyle,
  MapIcon,
  SceneryTownSource,
  StateCode,
  allIcons,
  defaultMapStyle,
} from '@truckermudgeon/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useState } from 'react';
import MapGl, {
  AttributionControl,
  FullscreenControl,
  NavigationControl,
} from 'react-map-gl/maplibre';
import { Legend } from './Legend';
import { MapSelectAndSearch } from './MapSelectAndSearch';

const createListProps = <T,>(
  selectedItems: Set<T>,
  setSelectedItems: (value: React.SetStateAction<Set<T>>) => void,
  allItems: ReadonlySet<T>,
) => ({
  selectedItems,
  onSelectAllToggle: (all: boolean) =>
    setSelectedItems(new Set(all ? allItems : [])),
  onItemToggle: (item: T, newValue: boolean) => {
    setSelectedItems((prevState: Set<T>) => {
      const newState = new Set(prevState);
      if (newValue) {
        newState.add(item);
      } else {
        newState.delete(item);
      }
      return newState;
    });
  },
});

const Demo = () => {
  const [autoHide, setAutoHide] = useState(true);
  const [visibleIcons, setVisibleIcons] = useState(new Set(allIcons));
  const [visibleAtsDlcs, setVisibleAtsDlcs] = useState(
    new Set(AtsSelectableDlcs),
  );

  const iconsListProps = createListProps(
    visibleIcons,
    setVisibleIcons,
    allIcons,
  );

  const atsDlcsListProps = createListProps(
    visibleAtsDlcs,
    setVisibleAtsDlcs,
    AtsSelectableDlcs,
  );

  return (
    <MapGl
      style={{ width: '100vw', height: '100vh' }} // ensure map fills page
      hash={true}
      minZoom={4}
      maxZoom={15}
      //        maxBounds={[
      //          // TODO calculate this based on pmtiles file header
      //          [-132, 24], // southwest corner (lon, lat)
      //          [-87, 51], // northeast corner (lon, lat)
      //        ]}
      mapStyle={defaultMapStyle}
      // start off in vegas
      initialViewState={{
        longitude: -115,
        latitude: 36,
        zoom: 9,
      }}
    >
      <BaseMapStyle />
      <GameMapStyle
        game={'ats'}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
        dlcs={visibleAtsDlcs}
      />
      <GameMapStyle
        game={'ets2'}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
      />
      {visibleIcons.has(MapIcon.CityNames) && (
        <SceneryTownSource
          enableAutoHide={autoHide}
          enabledStates={toStateCodes(visibleAtsDlcs)}
        />
      )}
      <NavigationControl visualizePitch={true} />
      <FullscreenControl />
      <AttributionControl
        compact={true}
        customAttribution="&copy; Trucker Mudgeon. scenery town data by <a href='https://github.com/nautofon/ats-towns'>nautofon</a>."
      />
      <MapSelectAndSearch />
      <Legend
        icons={{
          ...iconsListProps,
          enableAutoHiding: autoHide,
          onAutoHidingToggle: setAutoHide,
        }}
        atsDlcs={atsDlcsListProps}
      />
    </MapGl>
  );
};

function toStateCodes(atsDlcs: Set<AtsSelectableDlc>) {
  return new Set<StateCode>([...atsDlcs].map(toStateCode));
}

function toStateCode(atsDlc: AtsSelectableDlc): StateCode {
  switch (atsDlc) {
    case AtsDlc.Arizona:
      return StateCode.AZ;
    case AtsDlc.Colorado:
      return StateCode.CO;
    case AtsDlc.Idaho:
      return StateCode.ID;
    case AtsDlc.Kansas:
      return StateCode.KS;
    case AtsDlc.Montana:
      return StateCode.MT;
    case AtsDlc.Nevada:
      return StateCode.NV;
    case AtsDlc.NewMexico:
      return StateCode.NM;
    case AtsDlc.Oklahoma:
      return StateCode.OK;
    case AtsDlc.Oregon:
      return StateCode.OR;
    case AtsDlc.Texas:
      return StateCode.TX;
    case AtsDlc.Utah:
      return StateCode.UT;
    case AtsDlc.Washington:
      return StateCode.WA;
    case AtsDlc.Wyoming:
      return StateCode.WY;
    default:
      throw new UnreachableError(atsDlc);
  }
}

export default Demo;
