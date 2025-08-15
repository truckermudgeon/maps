import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter';
import { assertExists } from '@truckermudgeon/base/assert';
import { AtsSelectableDlcs } from '@truckermudgeon/map/constants';
import {
  allIcons,
  BaseMapStyle,
  defaultMapStyle,
  GameMapStyle,
} from '@truckermudgeon/ui';
import type { Mode } from '@truckermudgeon/ui/colors';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import { useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import MapGl, { Marker } from 'react-map-gl/maplibre';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import './StreetView.css';

export interface PanoramaMeta {
  id: string;
  point: [number, number];
  yaw?: number;
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
  mode?: Mode;
}) => {
  const { panorama, tileRootUrl, pixelRootUrl, mode = 'light' } = props;
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
        defaultYaw={props.panorama.yaw ?? 0}
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
          width: '200px',
          height: '200px',
          border: '2px solid black',
          borderRadius: 8,
          zIndex: 100,
        }}
        minZoom={9}
        maxZoom={14}
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
          rotation={((panorama.yaw ?? 0) / Math.PI) * 180}
          rotationAlignment={'map'}
        >
          <div className={'street-view-marker'} />
        </Marker>
        <BaseMapStyle tileRootUrl={tileRootUrl} mode={mode}></BaseMapStyle>
        <GameMapStyle
          tileRootUrl={tileRootUrl}
          game={'ats'}
          mode={mode}
          enableIconAutoHide={true}
          visibleIcons={allIcons}
          dlcs={AtsSelectableDlcs}
        />
        <GameMapStyle
          tileRootUrl={tileRootUrl}
          game={'ets2'}
          mode={mode}
          enableIconAutoHide={true}
          visibleIcons={allIcons}
        />
      </MapGl>
    </>
  );
};
