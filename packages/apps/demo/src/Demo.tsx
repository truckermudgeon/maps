import { useColorScheme } from '@mui/joy';
import { AtsSelectableDlcs } from '@truckermudgeon/map/constants';
import {
  allIcons,
  BaseMapStyle,
  ContoursStyle,
  defaultMapStyle,
  GameMapStyle,
  MapIcon,
  SceneryTownSource,
} from '@truckermudgeon/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useState } from 'react';
import MapGl, {
  AttributionControl,
  FullscreenControl,
  Marker,
  NavigationControl,
} from 'react-map-gl/maplibre';
import { useSearchParams } from 'react-router-dom';
import './Demo.css';
import { createListProps, Legend } from './Legend';
import { MapSelectAndSearch } from './MapSelectAndSearch';
import { ModeControl } from './ModeControl';
import { ShareControl } from './ShareControl';
import { toStateCodes } from './state-codes';

const inRange = (n: number, [min, max]: [number, number]) =>
  !isNaN(n) && min <= n && n <= max;

const Demo = () => {
  const { mode: _maybeMode, systemMode } = useColorScheme();
  const mode = _maybeMode === 'system' ? systemMode : _maybeMode;

  const [searchParams] = useSearchParams();
  const lat = Number(searchParams.get('mlat'));
  const lon = Number(searchParams.get('mlon'));
  const markerPos =
    inRange(lat, [-90, 90]) && inRange(lon, [-180, 180])
      ? { lat, lon }
      : undefined;

  const [autoHide, setAutoHide] = useState(true);
  const [visibleIcons, setVisibleIcons] = useState(new Set(allIcons));
  const [visibleAtsDlcs, setVisibleAtsDlcs] = useState(
    new Set(AtsSelectableDlcs),
  );
  const visibleStates = toStateCodes(visibleAtsDlcs);

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

  const [showContours, setShowContours] = useState(false);

  return (
    <MapGl
      style={{ width: '100svw', height: '100svh' }} // ensure map fills page
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
      {markerPos && (
        <Marker longitude={markerPos.lon} latitude={markerPos.lat} />
      )}
      <BaseMapStyle mode={mode}>
        <ContoursStyle game={'ats'} showContours={showContours} />
        <ContoursStyle game={'ets2'} showContours={showContours} />
      </BaseMapStyle>
      <GameMapStyle
        game={'ats'}
        mode={mode}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
        dlcs={visibleAtsDlcs}
      />
      <GameMapStyle
        game={'ets2'}
        mode={mode}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
      />
      {visibleIcons.has(MapIcon.CityNames) && (
        <SceneryTownSource
          mode={mode}
          enableAutoHide={autoHide}
          enabledStates={visibleStates}
        />
      )}
      <NavigationControl visualizePitch={true} />
      <FullscreenControl containerId={'fsElem'} />
      <ShareControl />
      <ModeControl />
      <AttributionControl
        compact={true}
        style={{
          marginLeft: 54,
        }}
        customAttribution="&copy; Trucker Mudgeon. scenery town data by <a href='https://github.com/nautofon/ats-towns'>nautofon</a>."
      />
      <MapSelectAndSearch visibleStates={visibleStates} />
      <Legend
        icons={{
          ...iconsListProps,
          enableAutoHiding: autoHide,
          onAutoHidingToggle: setAutoHide,
        }}
        advanced={{
          showContours,
          onContoursToggle: setShowContours,
        }}
        atsDlcs={atsDlcsListProps}
      />
    </MapGl>
  );
};

export default Demo;
