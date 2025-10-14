import { ArrowBack } from '@mui/icons-material';
import {
  Avatar,
  Box,
  Card,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/joy';
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter';
import type {
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
import type { Mode } from '@truckermudgeon/ui/colors';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import { memo, useMemo, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import MapGl, { Marker } from 'react-map-gl/maplibre';
import type { TilesAdapterSrc } from 'react-photo-sphere-viewer';
import {
  ReactPhotoSphereViewer,
  type ViewerAPI,
} from 'react-photo-sphere-viewer';
import type { PanoramaMeta } from './Demo';
import './StreetView.css';
import { calculatePanoHash } from './url-hash-utils';

const drivers = [
  {
    name: 'Trucker Mudgeon',
    avatarUrl: 'https://avatars.githubusercontent.com/u/121829201?v=4',
  },
  {
    name: 'San_Sany4',
    avatarUrl: 'https://avatars.githubusercontent.com/u/3860505?v=4',
  },
];

const makeSingleLevelPanoSrc = (pixelRootUrl: string, id: string) => {
  return {
    width: 8192,
    cols: 16,
    rows: 8,
    baseUrl: `${pixelRootUrl}/${id}_thumb.jpg`,
    tileUrl: (col: number, row: number) =>
      `${pixelRootUrl}/${id}_${col}_${row}.jpg`,
  };
};

const makeMultiLevelPanoramaFn = (
  pixelRootUrl: string,
): ((id: string) => TilesAdapterSrc) => {
  return (id: string) => ({
    baseUrl: `${pixelRootUrl}/${id}/thumb.jpg`,
    tileUrl: function (col: number, row: number, zoom: 0 | 1 = 0) {
      return `${pixelRootUrl}/${id}/${zoom}/${col}_${row}.jpg`;
    },
    width: 15_520,
    cols: 32,
    rows: 16,
    levels: [
      {
        width: 15_520 / 2,
        cols: 32 / 2,
        rows: 16 / 2,
        zoomRange: [0, 60],
      },
      {
        width: 15_520,
        cols: 32,
        rows: 16,
        zoomRange: [60, 100],
      },
    ],
  });
};

const debounce = <T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number,
) => {
  let timeoutTimer: ReturnType<typeof setTimeout>;
  return (...args: T) => {
    clearTimeout(timeoutTimer);
    timeoutTimer = setTimeout(() => {
      callback(...args);
    }, delay);
  };
};

export const StreetView = memo(
  (props: {
    panorama: PanoramaMeta[];
    tileRootUrl: string;
    pixelRootUrl: string;
    mode?: Mode;
    onClose: () => void;
  }) => {
    const {
      panorama: panos,
      tileRootUrl,
      pixelRootUrl,
      mode = 'light',
    } = props;
    const [currentPano, setCurrentPano] = useState(
      panos.find(p => p.active) ?? panos[0],
    );
    const [markerYaw, setMarkerYaw] = useState(
      (((panos.find(p => p.active) ?? panos[0]).yaw ?? 0) / Math.PI) * 180,
    );
    const mapRef = useRef<MapRef>(null);
    const viewerRef = useRef<ViewerAPI>(null);
    const markerRef = useRef<MapLibreGLMarker>(null);
    const hashUpdater = () => {
      const viewer = viewerRef.current;
      if (!viewer) {
        return;
      }
      let panoId;
      if (panos.length > 1) {
        const tourPlugin = assertExists(
          viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin),
        );
        const currentNode =
          tourPlugin.getCurrentNode() ??
          tourConfig.nodes?.find(n => n.id === tourConfig.startNodeId);
        if (!currentNode) {
          console.log('no node');
          return;
        }
        panoId = currentNode.id;
      } else {
        panoId = panos[0].id;
      }
      const panoHash = calculatePanoHash(viewer, panoId);
      const [mapHash] = window.location.hash.split('!');
      setCurrentPano(assertExists(panos.find(p => p.id === panoId)));
      window.location.hash = mapHash + panoHash;
    };
    const debouncedHashUpdater = debounce(hashUpdater, 300);

    const onPitchYawChanged = (_pitch: number, yaw: number) => {
      setMarkerYaw((yaw / Math.PI) * 180);
      debouncedHashUpdater();
    };

    const onZoomChange = () => {
      debouncedHashUpdater();
    };

    const onNodeChanged = ({ node }: { node: VirtualTourNode }) => {
      const [lon, lat] = assertExists(node.gps);
      const pos: [number, number] = [lon, lat];
      // use `?.` because it's possible for mapRef.current and markerRef.current
      // to be undefined when StreetView is dismissed in the middle of pitch/yaw
      // changes
      mapRef.current?.panTo(pos);
      markerRef.current?.setLngLat(pos);
      setCurrentPano(assertExists(panos.find(p => p.id === node.id)));
    };

    const onReady = () => {
      const viewer = assertExists(viewerRef.current);
      const tourPlugin = assertExists(
        viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin),
      );
      tourPlugin.addEventListener('node-changed', onNodeChanged);
      hashUpdater();
    };

    const pano = panos[0];
    const mlPano = makeMultiLevelPanoramaFn(pixelRootUrl);

    const tourConfig: VirtualTourPluginConfig = useMemo(() => {
      const config = {
        positionMode: 'gps' as const,
        nodes: panos.map((p, i) => ({
          id: p.id,
          panorama:
            panos.length === 1
              ? makeSingleLevelPanoSrc(pixelRootUrl, p.id)
              : mlPano(p.id),
          gps: p.point,
          links: [
            { nodeId: panos[i - 1]?.id },
            { nodeId: panos[i + 1]?.id },
          ].filter(l => l.nodeId != null),
        })),
        startNodeId: panos.find(p => p.active)?.id,
      };
      if (panos.length >= 3 && panos.some(p => p.loop)) {
        const firstNode = config.nodes.at(0)!;
        const lastNode = config.nodes.at(-1)!;
        firstNode.links.push({ nodeId: lastNode.id });
        lastNode.links.push({ nodeId: firstNode.id });
      }
      return config;
    }, [panos]);

    const src = tourConfig.nodes!.at(0)!.panorama as TilesAdapterSrc;

    return (
      <>
        <ReactPhotoSphereViewer
          ref={viewerRef}
          adapter={EquirectangularTilesAdapter}
          minFov={15}
          plugins={[VirtualTourPlugin.withConfig(tourConfig)]}
          src={src}
          height={'100vh'}
          width={'100%'}
          navbar={false}
          moveInertia={0.9}
          onPositionChange={onPitchYawChanged}
          onZoomChange={onZoomChange}
          defaultYaw={pano.yaw}
          defaultPitch={pano.pitch}
          defaultZoomLvl={pano.zoom}
          onReady={onReady}
        />
        <Card
          sx={{
            position: 'absolute',
            m: 2.5,
            top: 0,
            left: 0,
            background: '#000a',
          }}
          color="neutral"
          invertedColors
          variant="solid"
        >
          <Stack direction={'row'} gap={2} alignItems={'flex-start'}>
            <IconButton onClick={props.onClose}>
              <ArrowBack htmlColor={'#fff8'} />
            </IconButton>
            <PanoMeta pano={currentPano} />
          </Stack>
        </Card>
        <div className={'credits'}>
          Game data and images &copy; SCS Software.
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
            currentPano.point.map(v => v - 1) as [number, number], // southwest corner (lon, lat)
            currentPano.point.map(v => v + 1) as [number, number], // southwest corner (lon, lat)
          ]}
          mapStyle={defaultMapStyle}
          attributionControl={false}
          initialViewState={{
            longitude: currentPano.point[0],
            latitude: currentPano.point[1],
            zoom: 10,
          }}
        >
          <Marker
            ref={markerRef}
            longitude={currentPano.point[0]}
            latitude={currentPano.point[1]}
            rotation={markerYaw}
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
        </MapGl>
      </>
    );
  },
  (prevProps, nextProps) => {
    // HACK so hacky. but it works for now.
    const prev = JSON.stringify(prevProps.panorama.map(p => p.id));
    const next = JSON.stringify(nextProps.panorama.map(p => p.id));
    return prev === next;
  },
);

const PanoMeta = ({ pano }: { pano: PanoramaMeta }) => {
  const { name, avatarUrl } = drivers[pano.driverId];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography level={'title-lg'} sx={{ lineHeight: 1 }}>
        {pano.label}
        <Typography level={'body-xs'} sx={{ opacity: 0.8 }}>
          <br />
          {pano.location}
        </Typography>
      </Typography>
      <Stack
        direction={'row'}
        alignItems={'center'}
        gap={1}
        sx={{
          transformOrigin: 'left',
          transform: 'scale(0.8)',
          mt: -0.5,
        }}
      >
        <Avatar src={avatarUrl} size={'sm'} />
        <Typography level={'title-sm'}>{name}</Typography>
      </Stack>
      <Divider />
      <Stack direction={'row'} gap={2}>
        <Typography level={'body-xs'}>{pano.captureDate}</Typography>
      </Stack>
    </Box>
  );
};
