import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter';
import type { MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import '@photo-sphere-viewer/markers-plugin/index.css';
import type {
  GpsPosition,
  VirtualTourNode,
  VirtualTourPluginConfig,
} from '@photo-sphere-viewer/virtual-tour-plugin';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import '@photo-sphere-viewer/virtual-tour-plugin/index.css';
import { assertExists } from '@truckermudgeon/base/assert';
import { AtsSelectableDlcs } from '@truckermudgeon/map/constants';
import {
  allIcons,
  BaseMapStyle,
  defaultMapStyle,
  GameMapStyle,
} from '@truckermudgeon/ui';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import MapGl, { Marker } from 'react-map-gl/maplibre';
import type { ViewerAPI } from 'react-photo-sphere-viewer';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import './StreetViewDemo.css';

interface StreetViewDemoProps {
  tileRootUrl: string;
  pixelRootUrl: string;
}

interface PanoramaMeta {
  id: string;
  point: [number, number];
}

const panoramaMetas: PanoramaMeta[] = [
  { id: '0', point: [-92.12572989672026, 38.53421432713342] },
  { id: '1', point: [-92.12304341293509, 38.53672723512331] },
  { id: '2', point: [-92.11945284530871, 38.54133496582979] },
  { id: '3', point: [-92.11576785749503, 38.54478606247235] },
  //
  { id: '4', point: [-92.10778464530942, 38.544770729312454] },
  { id: '5', point: [-92.10258732764407, 38.541357585467786] },
  { id: '6', point: [-92.09670854574377, 38.53854148846571] },
  { id: '7', point: [-92.09328790813723, 38.53629576427041] },
  //
  { id: '8', point: [-92.11176575050796, 38.5479069429093] },
];

const viewpointMarker: MarkerConfig & { gps: GpsPosition } = {
  id: 'marker-viewpoint',
  image: 'map-icons/viewpoint.png',
  gps: [-92.102043, 38.54042],
  size: { width: 32, height: 32 },
};

const photoTrophyMarker: MarkerConfig & { gps: GpsPosition } = {
  id: 'marker-photo-trophy',
  image: 'map-icons/photo_sight_captured.png',
  gps: [-92.157874, 38.578638],
  size: { width: 32, height: 32 },
};

const viewpointAndPhotoTrophyMarkers = [viewpointMarker, photoTrophyMarker];

const makePanoramaFn = (pixelRootUrl: string) => {
  return (index: number) => ({
    width: 8192,
    cols: 16,
    rows: 8,
    baseUrl: `${pixelRootUrl}/${index}_thumb.jpg`,
    tileUrl: (col: number, row: number) =>
      `${pixelRootUrl}/${index}_${col}_${row}.jpg`,
  });
};

const makeTourConfig = (panorama: ReturnType<typeof makePanoramaFn>) => {
  const node = (index: number) => ({
    id: `node-${index}`,
    panorama: panorama(index),
    gps: panoramaMetas[index].point,
  });

  const links = (...indices: number[]) =>
    indices.map(index => ({
      nodeId: `node-${index}`,
    }));

  const tourConfig: VirtualTourPluginConfig = {
    positionMode: 'gps',
    nodes: [
      { ...node(0), links: links(1) },
      { ...node(1), links: links(0, 2) },
      { ...node(2), links: links(1, 3) },
      { ...node(3), links: links(2, 8) },
      //
      {
        ...node(4),
        links: links(8, 5),
        markers: viewpointAndPhotoTrophyMarkers,
      },
      {
        ...node(5),
        links: links(4, 6),
        markers: viewpointAndPhotoTrophyMarkers,
      },
      {
        ...node(6),
        links: links(5, 7),
        markers: viewpointAndPhotoTrophyMarkers,
      },
      {
        ...node(7),
        links: links(6),
        markers: viewpointAndPhotoTrophyMarkers,
      },
      //
      {
        ...node(8),
        links: links(3, 4),
        markers: viewpointAndPhotoTrophyMarkers,
      },
    ],
  };

  return tourConfig;
};

const StreetViewDemo = (props: StreetViewDemoProps) => {
  const mapRef = useRef<MapRef>(null);
  const viewerRef = useRef<ViewerAPI>(null);
  const markerRef = useRef<MapLibreGLMarker>(null);

  const panorama = makePanoramaFn(props.pixelRootUrl);
  const tourConfig = makeTourConfig(panorama);

  const onPitchYawChanged = (_pitch: number, yaw: number) =>
    assertExists(markerRef.current).setRotation((yaw / Math.PI) * 180);

  const onNodeChanged = ({ node }: { node: VirtualTourNode }) => {
    const [lon, lat] = assertExists(node.gps);
    const pos: [number, number] = [lon, lat];
    assertExists(mapRef.current).panTo(pos);
    assertExists(markerRef.current).setLngLat(pos);
  };

  const onReady = () => {
    const viewer = assertExists(viewerRef.current);
    const tourPlugin = assertExists(
      viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin),
    );
    tourPlugin.addEventListener('node-changed', onNodeChanged);
  };

  useEffect(() => {
    document.title = 'ATS Street View Proof of Concept';
  });

  return (
    <>
      <ReactPhotoSphereViewer
        ref={viewerRef}
        adapter={EquirectangularTilesAdapter}
        plugins={[VirtualTourPlugin.withConfig(tourConfig), MarkersPlugin]}
        src={panorama(0)}
        height={'100vh'}
        width={'100%'}
        navbar={false}
        moveInertia={0.9}
        onPositionChange={onPitchYawChanged}
        onReady={onReady}
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
          panoramaMetas[0].point.map(v => v - 1) as [number, number], // southwest corner (lon, lat)
          panoramaMetas[0].point.map(v => v + 1) as [number, number], // southwest corner (lon, lat)
        ]}
        mapStyle={defaultMapStyle}
        attributionControl={false}
        initialViewState={{
          longitude: panoramaMetas[0].point[0],
          latitude: panoramaMetas[0].point[1],
          zoom: 12,
        }}
      >
        <Marker
          ref={markerRef}
          longitude={panoramaMetas[0].point[0]}
          latitude={panoramaMetas[0].point[1]}
          rotationAlignment={'map'}
        >
          <div className={'street-view-marker'} />
        </Marker>
        <BaseMapStyle
          tileRootUrl={props.tileRootUrl}
          mode={'light'}
        ></BaseMapStyle>
        <GameMapStyle
          tileRootUrl={props.tileRootUrl}
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

export default StreetViewDemo;
