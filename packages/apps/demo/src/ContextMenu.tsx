import { Close, ContentCopy, Public, SportsEsports } from '@mui/icons-material';
import type { SnackbarCloseReason } from '@mui/joy';
import {
  Chip,
  IconButton,
  ListDivider,
  ListItem,
  ListItemContent,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Typography,
} from '@mui/joy';
import type { VirtualElement } from '@popperjs/core/lib/types';
import { assert, assertExists } from '@truckermudgeon/base/assert';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { fromWgs84ToAtsCoords } from '@truckermudgeon/map/projections';
import type { GeoJSON } from 'geojson';
import type {
  GeoJSONSource,
  MapLayerMouseEvent,
  MapMouseEvent,
} from 'maplibre-gl';
import { Fragment, memo, useCallback, useEffect, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';

interface ClickContext {
  anchorEl: VirtualElement;
  position?: {
    lngLat: [number, number];
    xz: [number, number];
  };
}

const toFixed = (f: number, tuple: [number, number]): [number, number] =>
  tuple.map(v => Number(v.toFixed(f))) as [number, number];

let idCounter = 0;
const newId = () => {
  const stringId = idCounter.toString(36);
  idCounter++;
  return stringId;
};

type PointFeature = GeoJSON.Feature<GeoJSON.Point, { id: string }>;

export const ContextMenu = () => {
  console.log('render ContextMenu');

  const map = assertExists(useMap().current);
  const [clickContext, setClickContext] = useState<ClickContext | null>(null);
  const [showClipboardToast, setShowClipboardToast] = useState<boolean>(false);
  const [measuring, setMeasuring] = useState<boolean>(false);
  const [measuringPoints, setMeasuringPoints] = useState<
    [lon: number, lat: number][]
  >([]);

  const closeClipboardToast = useCallback((reason: SnackbarCloseReason) => {
    if (reason !== 'clickaway') {
      setShowClipboardToast(false);
    }
  }, []);

  const closeMeasuringToast = useCallback(() => {
    setMeasuring(false);
    setMeasuringPoints([]);
  }, []);

  const createCopyHandler = (mode: 'lngLat' | 'xz') => {
    return () => {
      setShowClipboardToast(true);
      const pos = assertExists(clickContext?.position);
      switch (mode) {
        case 'lngLat':
          void navigator.clipboard.writeText(pos.lngLat.join(','));
          break;
        case 'xz':
          void navigator.clipboard.writeText(pos.xz.join(';'));
          break;
        default:
          throw new UnreachableError(mode);
      }
    };
  };

  const closeContextMenu = useCallback(() => {
    setClickContext(null);
    map.off('move', closeContextMenu);
  }, []);

  useEffect(() => {
    const showContextMenu = (e: MapLayerMouseEvent) => {
      const { clientX, clientY } = e.originalEvent;
      const lngLat = e.lngLat.toArray();
      const xz = fromWgs84ToAtsCoords(lngLat);

      setClickContext({
        position: {
          lngLat: toFixed(4, lngLat),
          xz: toFixed(1, xz),
        },
        anchorEl: {
          getBoundingClientRect: () => ({
            width: 0,
            height: 0,
            top: clientY,
            right: clientX,
            bottom: clientY,
            left: clientX,
          }),
        } as VirtualElement,
      });

      console.log('installing move handler');
      void map.once('move', closeContextMenu);
    };

    map.on('contextmenu', showContextMenu);
    return () => void map.off('contextmenu', showContextMenu);
  }, [map]);

  useEffect(() => {
    console.log('measuring points effect');
    if (!measuring) {
      map.getCanvas().style.cursor = '';
      return;
    }

    // based on https://maplibre.org/maplibre-gl-js/docs/examples/measure-distances/

    const linestring: GeoJSON.Feature<GeoJSON.LineString, { id: string }> = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: measuringPoints,
      },
      properties: { id: newId() },
    };

    const geojson: GeoJSON.FeatureCollection<
      GeoJSON.Point | GeoJSON.LineString,
      { id: string }
    > = {
      type: 'FeatureCollection',
      features: [
        ...measuringPoints.map(
          point =>
            ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: point,
              },
              properties: { id: newId() },
            }) as PointFeature,
        ),
        ...(measuringPoints.length > 1 ? [linestring] : []),
      ],
    };

    const setCursor = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['measure-points'],
      });
      // UI indicator for clicking/hovering a point on the map
      map.getCanvas().style.cursor = features.length ? 'pointer' : 'crosshair';
    };

    const addOrDeletePoint = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['measure-points'],
      });

      // Remove the linestring from the group
      // So we can redraw it based on the points collection
      if (geojson.features.length > 1) {
        geojson.features.pop();
      }

      // If a point was clicked, remove it from the map
      if (features.length) {
        const id = (features[0].properties as { id: string }).id;
        geojson.features = geojson.features.filter(point => {
          return point.properties.id !== id;
        });
      } else {
        const point: PointFeature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [e.lngLat.lng, e.lngLat.lat],
          },
          properties: {
            id: newId(),
          },
        };

        geojson.features.push(point);
      }

      if (geojson.features.length > 1) {
        linestring.geometry.coordinates = geojson.features.map(maybePoint => {
          assert(
            maybePoint.geometry.type === 'Point',
            `unexpected non-Point geometry: ${maybePoint.geometry.type}`,
          );
          const point: PointFeature = maybePoint as PointFeature;
          return point.geometry.coordinates;
        });

        geojson.features.push(linestring);
      }

      assertExists(map.getSource<GeoJSONSource>('measure')).setData(geojson);
      setMeasuringPoints(
        geojson.features
          .filter(f => f.geometry.type === 'Point')
          .map(p => p.geometry.coordinates as [number, number]),
      );
    };

    map.on('mousemove', setCursor);
    map.on('click', addOrDeletePoint);
    assertExists(map.getSource<GeoJSONSource>('measure')).setData(geojson);

    return () => {
      console.log('measurer effect cleanup');
      map.off('mousemove', setCursor);
      map.off('click', addOrDeletePoint);
      assertExists(map.getSource<GeoJSONSource>('measure')).setData({
        type: 'FeatureCollection',
        features: [],
      });
    };
  }, [map, measuringPoints, measuring]);

  return (
    <>
      <div
        style={{
          display: clickContext != null ? 'block' : 'none',
          zIndex: 10,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        onMouseDown={e => {
          if (e.currentTarget === e.target) {
            // only close if user mousedowns on this click-away div, because
            // we don't want bubbled events (e.g., when a mousedown happens on
            // a descendant <MenuItem>) to close the context menu.
            closeContextMenu();
          }
        }}
      >
        <Menu
          size={'sm'}
          open={clickContext != null}
          anchorEl={clickContext?.anchorEl}
          placement={'bottom-start'}
          onClick={closeContextMenu}
          onContextMenu={e => e.preventDefault()}
        >
          {clickContext?.position ? (
            <>
              <MenuItem
                sx={{ justifyContent: 'space-between' }}
                onClick={createCopyHandler('lngLat')}
              >
                <Public />
                <ListItemContent>
                  <LabeledCoordinates
                    coords={{
                      lat: clickContext.position.lngLat[1],
                      lng: clickContext.position.lngLat[0],
                    }}
                  />
                </ListItemContent>
                <ContentCopy sx={{ ml: 1 }} />
              </MenuItem>
              <MenuItem
                sx={{ justifyContent: 'space-between' }}
                onClick={createCopyHandler('xz')}
              >
                <SportsEsports />
                <ListItemContent>
                  <LabeledCoordinates
                    coords={{
                      x: clickContext.position.xz[0],
                      z: clickContext.position.xz[1],
                    }}
                  />
                </ListItemContent>
                <ContentCopy sx={{ ml: 1 }} />
              </MenuItem>
              <ListDivider />
              {measuring ? (
                <MenuItem onClick={closeMeasuringToast}>
                  Clear measurement
                </MenuItem>
              ) : (
                <MenuItem
                  onClick={() => {
                    setMeasuring(true);
                    setMeasuringPoints([
                      assertExists(clickContext?.position).lngLat,
                    ]);
                  }}
                >
                  Measure distance
                </MenuItem>
              )}
            </>
          ) : (
            <ListItem>Share this location</ListItem>
          )}
        </Menu>
      </div>
      <MeasuringToast
        open={measuring}
        close={closeMeasuringToast}
        measuringPoints={measuringPoints}
      />
      <CopiedToClipboardToast
        open={showClipboardToast}
        close={closeClipboardToast}
      />
    </>
  );
};

const LabeledCoordinates = (props: {
  /** map of component label to value */
  coords: Record<string, number>;
}) => {
  return Object.entries(props.coords).map(([label, value], index) => (
    <Fragment key={label}>
      {index > 0 ? <span>&nbsp;&nbsp;</span> : null}
      <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
        {label}
      </Chip>
      {value.toLocaleString()}
    </Fragment>
  ));
};

const MeasuringToast = memo(
  (props: {
    measuringPoints: [lon: number, lat: number][];
    open: boolean;
    close: () => void;
  }) => {
    console.log('render measuring toast');
    return (
      <Snackbar
        open={props.open}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        size={'sm'}
        sx={{ alignItems: 'baseline', mb: 4 }}
        endDecorator={
          <IconButton onClick={props.close}>
            <Close />
          </IconButton>
        }
      >
        <Stack gap={1}>
          <Typography level={'title-md'}>Measure distance</Typography>
          {props.measuringPoints.length <= 1 ? (
            <Typography level={'body-sm'}>
              Click on the map to trace a path you want to measure.
            </Typography>
          ) : (
            <Stack gap={2}>
              <Typography level={'body-sm'}>
                Click on the map to add to your path. Click on an existing point
                to remove it from the path.
              </Typography>
              <Typography level={'title-sm'}>
                Total distance: 120.98 mi (194.70 km)
              </Typography>
            </Stack>
          )}
        </Stack>
      </Snackbar>
    );
  },
);

const CopiedToClipboardToast = memo(
  (props: { open: boolean; close: (reason: SnackbarCloseReason) => void }) => {
    console.log('render clipboard toast');
    return (
      <Snackbar
        open={props.open}
        onClose={(_, reason) => props.close(reason)}
        autoHideDuration={3000}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        size={'sm'}
        endDecorator={
          <IconButton onClick={() => props.close('escapeKeyDown')}>
            <Close />
          </IconButton>
        }
      >
        Copied to clipboard.
      </Snackbar>
    );
  },
);
