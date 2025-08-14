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
  trafficMapIcons,
} from '@truckermudgeon/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import MapGl, {
  AttributionControl,
  FullscreenControl,
  Layer,
  Marker,
  NavigationControl,
  Source,
} from 'react-map-gl/maplibre';
import { useSearchParams } from 'react-router-dom';
import { ContextMenu } from './ContextMenu';
import './Demo.css';
import { createListProps, Legend } from './Legend';
import { ModeControl } from './ModeControl';
import { mapCenters, OmniBar } from './OmniBar';
import { PhotoSphereControl } from './PhotoSphereControl';
import { ShareControl } from './ShareControl';
import { toStateCodes } from './state-codes';
import type { PanoramaMeta } from './StreetView';
import { StreetView } from './StreetView';

const inRange = (n: number, [min, max]: [number, number]) =>
  !isNaN(n) && min <= n && n <= max;

const Demo = (props: { tileRootUrl: string; pixelRootUrl: string }) => {
  const mapRef = useRef<MapRef>(null);

  const { tileRootUrl, pixelRootUrl } = props;
  const { mode: _maybeMode, systemMode } = useColorScheme();
  const mode = _maybeMode === 'system' ? systemMode : _maybeMode;
  const { longitude, latitude } =
    mapCenters[ensureValidMapValue(localStorage.getItem('tm-map'))];

  const [searchParams] = useSearchParams();
  const lat = Number(searchParams.get('mlat') ?? undefined);
  const lon = Number(searchParams.get('mlon') ?? undefined);
  const markerPos =
    inRange(lat, [-90, 90]) && inRange(lon, [-180, 180])
      ? { lat, lon }
      : undefined;

  const allButTrafficIcons = new Set(
    [...allIcons].filter(i => !trafficMapIcons.includes(i)),
  );
  const [autoHide, setAutoHide] = useState(true);
  const [visibleIcons, setVisibleIcons] = useState(allButTrafficIcons);
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

  const [showStreetViewLayer, setShowStreetViewLayer] = useState(false);
  const [panorama, setPanorama] = useState<PanoramaMeta | null>(null);

  const slippyMap = (
    <MapGl
      ref={mapRef}
      style={{ width: '100svw', height: '100svh' }} // ensure map fills page
      hash={true}
      minZoom={4}
      maxZoom={15}
      mapStyle={defaultMapStyle}
      attributionControl={false}
      initialViewState={{
        longitude,
        latitude,
        zoom: 4,
      }}
    >
      {markerPos && (
        <Marker longitude={markerPos.lon} latitude={markerPos.lat} />
      )}
      <BaseMapStyle tileRootUrl={tileRootUrl} mode={mode}>
        <ContoursStyle
          tileRootUrl={tileRootUrl}
          game={'ats'}
          showContours={showContours}
        />
        <ContoursStyle
          tileRootUrl={tileRootUrl}
          game={'ets2'}
          showContours={showContours}
        />
      </BaseMapStyle>
      <GameMapStyle
        tileRootUrl={tileRootUrl}
        game={'ats'}
        mode={mode}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
        dlcs={visibleAtsDlcs}
      />
      <GameMapStyle
        tileRootUrl={tileRootUrl}
        game={'ets2'}
        mode={mode}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
      />
      {visibleIcons.has(MapIcon.CityNames) && (
        <SceneryTownSource
          game={'ats'}
          mode={mode}
          enableAutoHide={autoHide}
          enabledStates={visibleStates}
        />
      )}
      {visibleIcons.has(MapIcon.CityNames) && (
        <SceneryTownSource
          game={'ets2'}
          mode={mode}
          enableAutoHide={autoHide}
        />
      )}
      {showStreetViewLayer && (
        <Source
          id={'street-view'}
          type={'geojson'}
          data={'/street-view.geojson'}
          cluster={true}
          clusterMaxZoom={7}
          clusterRadius={10}
        >
          <Layer
            id={'photo-spheres-halo'}
            type={'circle'}
            paint={{
              'circle-radius': 10,
              'circle-color': '#fff8',
              'circle-blur': 0.75,
            }}
            filter={['in', '$type', 'Point']}
          />
          <Layer
            id={'photo-spheres'}
            type={'circle'}
            paint={{
              'circle-radius': 5,
              'circle-color': '#48f2',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#48f',
            }}
            filter={['in', '$type', 'Point']}
          />
        </Source>
      )}
      <Source
        id={'measure'}
        type={'geojson'}
        data={{
          type: 'FeatureCollection',
          features: [],
        }}
      >
        <Layer
          id={'measure-lines'}
          type={'line'}
          paint={{
            'line-color': '#f00',
            'line-width': 3,
            'line-opacity': 1,
          }}
          filter={['in', '$type', 'LineString']}
        />
        <Layer
          id={'measure-points'}
          type={'circle'}
          paint={{
            'circle-radius': 5,
            'circle-color': '#fff',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#f00',
          }}
          filter={['in', '$type', 'Point']}
        />
      </Source>
      <NavigationControl visualizePitch={true} />
      <PhotoSphereControl onToggle={setShowStreetViewLayer} />
      <FullscreenControl containerId={'fsElem'} />
      <ShareControl />
      <ModeControl />
      <AttributionControl
        compact={true}
        style={{
          marginLeft: 54,
        }}
        customAttribution="&copy; Trucker Mudgeon. scenery town data by <a href='https://github.com/nautofon/ats-towns'>nautofon</a> and <a href='https://forum.scssoft.com/viewtopic.php?p=1946956#p1946956'>krmarci</a>."
      />
      <OmniBar
        visibleStates={visibleStates}
        visibleStateDlcs={visibleAtsDlcs}
      />
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
      <ContextMenu />
    </MapGl>
  );

  return (
    <>
      {slippyMap}
      {panorama && (
        <StreetView
          tileRootUrl={tileRootUrl}
          pixelRootUrl={pixelRootUrl}
          panorama={panorama}
        />
      )}
    </>
  );
};

function ensureValidMapValue(
  maybeMap: string | null | undefined,
): 'usa' | 'europe' {
  return maybeMap === 'europe' ? maybeMap : 'usa';
}

export default Demo;
