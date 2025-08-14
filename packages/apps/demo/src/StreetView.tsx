import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter';
import { assertExists } from '@truckermudgeon/base/assert';
import { AtsSelectableDlcs } from '@truckermudgeon/map/constants';
import {
  allIcons,
  BaseMapStyle,
  defaultMapStyle,
  GameMapStyle,
} from '@truckermudgeon/ui';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import { useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import MapGl, { Marker } from 'react-map-gl/maplibre';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import './StreetView.css';

export interface PanoramaMeta {
  id: string;
  point: [number, number];
}

const makePanoSrc = (pixelRootUrl: string, id: string) => {
  return {
    width: 8192,
    cols: 16,
    rows: 8,
    baseUrl: `${pixelRootUrl}/${id}_thumb.jpg`,
    tileUrl: (col: number, row: number) =>
      `${pixelRootUrl}/${id}_${col}_${row}.jpg`,
  };
};

export const StreetView = (props: {
  panorama: PanoramaMeta;
  tileRootUrl: string;
  pixelRootUrl: string;
}) => {
  const { panorama, tileRootUrl, pixelRootUrl } = props;
  const mapRef = useRef<MapRef>(null);
  const markerRef = useRef<MapLibreGLMarker>(null);

  const onPitchYawChanged = (_pitch: number, yaw: number) =>
    assertExists(markerRef.current).setRotation((yaw / Math.PI) * 180);

  return (
    <>
      <ReactPhotoSphereViewer
        adapter={EquirectangularTilesAdapter}
        src={makePanoSrc(pixelRootUrl, panorama.id)}
        height={'100vh'}
        width={'100%'}
        navbar={false}
        moveInertia={0.9}
        onPositionChange={onPitchYawChanged}
      />
      <div className={'credits'}>
        Game data and images &copy; SCS Software. Images captured by Trucker
        Mudgeon.
      </div>
      <MapGl
        ref={mapRef}
        style={{
          position: 'absolute',
          left: 20,
          bottom: 20,
          width: '250px',
          height: '125px',
          border: '2px solid black',
          borderRadius: 8,
          zIndex: 100,
        }}
        minZoom={4}
        maxZoom={15}
        maxBounds={[
          panorama.point.map(v => v - 1) as [number, number], // southwest corner (lon, lat)
          panorama.point.map(v => v + 1) as [number, number], // southwest corner (lon, lat)
        ]}
        mapStyle={defaultMapStyle}
        attributionControl={false}
        initialViewState={{
          longitude: panorama.point[0],
          latitude: panorama.point[1],
          zoom: 12,
        }}
      >
        <Marker
          ref={markerRef}
          longitude={panorama.point[0]}
          latitude={panorama.point[1]}
          rotationAlignment={'map'}
        >
          <div className={'street-view-marker'} />
        </Marker>
        <BaseMapStyle tileRootUrl={tileRootUrl} mode={'light'}></BaseMapStyle>
        <GameMapStyle
          tileRootUrl={tileRootUrl}
          game={'ats'}
          mode={'light'}
          enableIconAutoHide={true}
          visibleIcons={allIcons}
          dlcs={AtsSelectableDlcs}
        />
      </MapGl>
    </>
  );
};
