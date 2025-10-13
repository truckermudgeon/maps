import CloseIcon from '@mui/icons-material/Close';
import { IconButton, useColorScheme } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { AtsSelectableDlcs } from '@truckermudgeon/map/constants';
import type { PanoramaMeta } from '@truckermudgeon/map/types';
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
import nearestPointOnLine from '@turf/nearest-point-on-line';
import type { GeoJSON } from 'geojson';
import type { MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import MapGl, {
  AttributionControl,
  FullscreenControl,
  Layer,
  Marker,
  NavigationControl,
  Popup,
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
import { StreetView } from './StreetView';
import { PanoramaPreview } from './StreetViewPreview';
import {
  calculateMapHash,
  syncCameraToHash,
  toPanoCamera,
} from './url-hash-utils';

const inRange = (n: number, [min, max]: [number, number]) =>
  !isNaN(n) && min <= n && n <= max;

interface PhotoSphereProperties {
  id: string;
  yaw: number;
  label: string;
  location: string;
}

interface StreetViewProperties {
  id: string;
  location: string;
  panos: {
    id: string;
    label: string;
  }[];
}

type PhotoSphereFeature = GeoJSON.Feature<GeoJSON.Point, PhotoSphereProperties>;
type StreetViewFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  StreetViewProperties
>;

type StreetViewGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Point | GeoJSON.LineString,
  StreetViewProperties
>;

const Demo = (props: { tileRootUrl: string; pixelRootUrl: string }) => {
  console.log('render demo');

  const { tileRootUrl, pixelRootUrl } = props;
  const { mode: _maybeMode, systemMode } = useColorScheme();
  const mode = _maybeMode === 'system' ? systemMode : _maybeMode;
  const { longitude, latitude } =
    mapCenters[ensureValidMapValue(localStorage.getItem('tm-map'))];
  if (!window.location.hash) {
    window.location.hash =
      '#' +
      [
        4, // default zoom
        Number(latitude.toFixed(3)),
        Number(longitude.toFixed(3)),
      ].join('/');
  }

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

  const [showSecrets, setShowSecrets] = useState<boolean>(
    localStorage.getItem('tm-secrets') !== 'hide',
  );
  const [showContours, setShowContours] = useState(false);
  const [showPhotoSpheresUi, setShowPhotoSpheresUi] = useState(false);

  const mapRef = useRef<MapRef>(null);
  const [showStreetViewLayer, setShowStreetViewLayer] = useState(false);
  const [panorama, setPanorama] = useState<PanoramaMeta[] | null>(null);
  const [panoramaPreview, setPanoramaPreview] = useState<PanoramaMeta | null>(
    null,
  );
  const clearPanorama = useCallback(() => setPanorama(null), []);

  const [streetViewGeoJSON, setStreetViewGeoJSON] =
    useState<StreetViewGeoJSON | null>(null);

  useEffect(() => {
    if (!mapRef.current || !streetViewGeoJSON) {
      return;
    }

    const map = mapRef.current;
    syncCameraToHash(map, window.location.hash);
    syncPanoToHash(window.location.hash.split('!')[1]);

    const updateHash = () => (window.location.hash = calculateMapHash(map));
    map.on('moveend', updateHash);

    const onHashChange = () => {
      const [mapHash, panoHash] = window.location.hash.split('!');
      syncCameraToHash(map, mapHash);
      syncPanoToHash(panoHash);
    };
    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      map.off('moveend', updateHash);
    };
  }, [mapRef.current, streetViewGeoJSON]);

  const syncPanoToHash = useCallback(
    (panoHash: string | undefined) => {
      if (streetViewGeoJSON == null || panoHash == null) {
        return;
      }

      const { id, yaw, pitch, zoom } = toPanoCamera('!' + panoHash);
      if (panorama?.some(p => p.id === id)) {
        return;
      }

      console.log('sync pano to id', id);
      // search photosphere points
      const matchingPhotoSphere = streetViewGeoJSON.features.find(
        f => f.properties.id === id && f.geometry.type === 'Point',
      ) as unknown as PhotoSphereFeature;
      if (matchingPhotoSphere) {
        // HACK
        if (!showPhotoSpheresUi || !showStreetViewLayer) {
          setShowPhotoSpheresUi(true);
          setShowStreetViewLayer(true);
        }
        setPanorama([
          {
            id: matchingPhotoSphere.properties.id,
            location: matchingPhotoSphere.properties.location,
            point: matchingPhotoSphere.geometry.coordinates as [number, number],
            label: matchingPhotoSphere.properties.label,
            yaw,
            pitch,
            zoom,
          },
        ]);
        return;
      }

      // search streetview linestrings
      const matchingStreetView = streetViewGeoJSON.features.find(
        f =>
          f.geometry.type === 'LineString' &&
          f.properties.panos.some(p => p.id === id),
      ) as StreetViewFeature;
      if (matchingStreetView) {
        // HACK
        if (!showPhotoSpheresUi || !showStreetViewLayer) {
          setShowPhotoSpheresUi(true);
          setShowStreetViewLayer(true);
        }
        setPanorama(
          matchingStreetView.properties.panos.map((props, i) => ({
            id: props.id,
            active: props.id === id ? true : undefined,
            point: matchingStreetView.geometry.coordinates[i] as [
              number,
              number,
            ],
            label: props.label,
            location: matchingStreetView.properties.location,
            yaw,
            pitch,
            zoom,
          })),
        );
        return;
      }
    },
    [streetViewGeoJSON, panorama],
  );

  useEffect(() => {
    fetch('/street-view.geojson')
      .then(res => res.json() as Promise<StreetViewGeoJSON>)
      .then(json => setStreetViewGeoJSON(json))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (
      !mapRef.current ||
      !showStreetViewLayer ||
      !showPhotoSpheresUi ||
      !streetViewGeoJSON
    ) {
      return;
    }

    const map = mapRef.current;
    const setCursor = (e: MapMouseEvent) => {
      const panoFeature = map.queryRenderedFeatures(e.point, {
        layers: ['photo-spheres'],
      })[0];
      const streetFeature = map.queryRenderedFeatures(e.point, {
        layers: ['sv-streets'],
      })[0];
      // UI indicator for clicking/hovering a point on the map
      map.getCanvas().style.cursor =
        panoFeature || streetFeature ? 'pointer' : '';
      if (panoFeature) {
        if (panoramaPreview?.id !== panoFeature.properties['id']) {
          const pointFeature = panoFeature as unknown as GeoJSON.Feature<
            GeoJSON.Point,
            { id: string; yaw: number; label: string; location: string }
          >;
          setPanoramaPreview({
            id: pointFeature.properties.id,
            location: pointFeature.properties.location,
            point: pointFeature.geometry.coordinates as [number, number],
            yaw: pointFeature.properties.yaw,
            label: pointFeature.properties.label,
          });
        }
      } else {
        if (panoramaPreview) {
          setPanoramaPreview(null);
        }
      }
    };

    const maybeOpenPanorama = (e: MapMouseEvent) => {
      const panoFeature = map.queryRenderedFeatures(e.point, {
        layers: ['photo-spheres'],
      })[0];
      if (panoFeature && panoFeature.properties['cluster'] !== true) {
        setPanoramaPreview(null);
        setPanorama(panoramaPreview == null ? null : [panoramaPreview]);
        return;
      }

      const streetFeature = map.queryRenderedFeatures(e.point, {
        layers: ['sv-streets'],
      })[0];
      if (streetFeature) {
        setPanoramaPreview(null);
        const lineId = (
          streetFeature as unknown as StreetViewGeoJSON['features'][number]
        ).properties.id;
        const lineFeature = assertExists(
          streetViewGeoJSON.features.find(f => f.properties.id === lineId),
        ) as StreetViewFeature;
        const nearestPointIndex = nearestPointOnLine(lineFeature, [
          e.point.x,
          e.point.y,
        ]).properties.index;

        setPanorama(
          lineFeature.properties.panos.map((props, i) => ({
            id: props.id,
            active: i === nearestPointIndex ? true : undefined,
            point: lineFeature.geometry.coordinates[i] as [number, number],
            label: props.label,
            location: lineFeature.properties.location,
          })),
        );
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (panorama != null && e.key === 'Escape') {
        setPanorama(null);
      }
    };

    if (panorama) {
      document.addEventListener('keydown', handleEscape);
    }
    map.on('mousemove', setCursor);
    map.on('click', maybeOpenPanorama);
    return () => {
      map.off('mousemove', setCursor);
      map.off('click', maybeOpenPanorama);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [
    mapRef.current,
    showStreetViewLayer,
    panorama,
    panoramaPreview,
    showPhotoSpheresUi,
    streetViewGeoJSON,
  ]);

  const slippyMap = (
    <MapGl
      ref={mapRef}
      style={{
        width: '100svw',
        height: '100svh',
        display: panorama ? 'none' : undefined,
      }}
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
        showSecrets={showSecrets}
        dlcs={visibleAtsDlcs}
      />
      <GameMapStyle
        tileRootUrl={tileRootUrl}
        game={'ets2'}
        mode={mode}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
        showSecrets={showSecrets}
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
      {showPhotoSpheresUi && showStreetViewLayer && (
        <Source
          id={'street-view'}
          type={'geojson'}
          data={'/street-view.geojson'}
          cluster={false} // TODO: re-enable once mouse-event handling on clusters is fixed.
          clusterMaxZoom={7}
          clusterRadius={10}
        >
          <Layer
            id={'photo-spheres-halo'}
            type={'circle'}
            paint={{
              'circle-radius': 10,
              'circle-color': mode === 'light' ? '#fff8' : '#8884',
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
          <Layer
            id={'sv-streets-case'}
            type={'line'}
            paint={{
              'line-color': '#aef',
              'line-width': 2,
              'line-gap-width': 4,
            }}
            filter={['in', '$type', 'LineString']}
          />
          <Layer
            id={'sv-streets'}
            type={'line'}
            paint={{
              'line-color': '#2ab',
              'line-width': 4,
            }}
            filter={['in', '$type', 'LineString']}
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
      <PhotoSphereControl
        visible={showPhotoSpheresUi}
        onToggle={setShowStreetViewLayer}
      />
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
          showSecrets,
          onSecretsToggle: newValue => {
            setShowSecrets(newValue);
            localStorage.setItem(
              'tm-secrets',
              newValue ? 'showAsNormal' : 'hide',
            );
          },
          showContours,
          onContoursToggle: setShowContours,
          showPhotoSpheresUi,
          onPhotoSpheresToggleUi: setShowPhotoSpheresUi,
        }}
        atsDlcs={atsDlcsListProps}
      />
      {panoramaPreview && (
        <Popup
          className={'pano-preview-popup'}
          closeButton={false}
          closeOnClick={false}
          closeOnMove={true}
          longitude={panoramaPreview.point[0]}
          latitude={panoramaPreview.point[1]}
        >
          <PanoramaPreview
            panorama={panoramaPreview}
            pixelRootUrl={pixelRootUrl}
          />
        </Popup>
      )}
      <ContextMenu />
    </MapGl>
  );

  return (
    <>
      {slippyMap}
      {panorama && (
        <>
          <StreetView
            tileRootUrl={tileRootUrl}
            pixelRootUrl={pixelRootUrl}
            panorama={panorama}
            mode={mode}
            onClose={clearPanorama}
          />
          <IconButton
            sx={{
              background: '#000a',
              position: 'absolute',
              borderRadius: '50%',
              m: 2.5,
              top: 0,
              right: 0,
            }}
            size={'lg'}
            variant={'solid'}
            onClick={clearPanorama}
          >
            <CloseIcon />
          </IconButton>
        </>
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
