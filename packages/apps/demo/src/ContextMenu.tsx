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
import type { Extent } from '@truckermudgeon/base/geom';
import {
  center,
  contains,
  distance as euclideanDistance,
} from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import {
  fromWgs84ToAtsCoords,
  fromWgs84ToEts2Coords,
} from '@truckermudgeon/map/projections';
import { distance } from '@turf/distance';
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
  closestGame: 'ats' | 'ets2';
  position: {
    lngLat: [number, number];
    // `xz` is undefined when context menu is brought up at a point that
    // is not in bounds of the ATS or ETS2 map.
    xz: [number, number] | undefined;
  };
}

type PointFeature = GeoJSON.Feature<GeoJSON.Point, { id: number }>;

// TODO read these values from the .pmtiles files at runtime.
const extents = {
  ats: [
    [-124.477162, 25.767968].map(n => Math.floor(n)),
    [-88.777474, 49.1223839].map(n => Math.ceil(n)),
  ].flat() as Extent,
  ets2: [
    [-10.025698, 34.897275].map(n => Math.floor(n)),
    [33.284941, 61.881437].map(n => Math.ceil(n)),
  ].flat() as Extent,
};

export const ContextMenu = () => {
  const map = assertExists(useMap().current);
  const [clickContext, setClickContext] = useState<ClickContext | null>(null);
  const [showClipboardToast, setShowClipboardToast] = useState<boolean>(false);
  const [measuring, setMeasuring] = useState<'ats' | 'ets2' | false>(false);
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
      const pos = assertExists(clickContext).position;
      switch (mode) {
        case 'lngLat':
          void navigator.clipboard.writeText(
            pos.lngLat.map(n => toFixed(n, 4)).join(','),
          );
          break;
        case 'xz':
          void navigator.clipboard.writeText(
            assertExists(pos.xz)
              .map(n => toFixed(n, 1))
              .join(';'),
          );
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
      let xz: [number, number] | undefined;
      if (contains(extents.ats, lngLat)) {
        xz = fromWgs84ToAtsCoords(lngLat);
      } else if (contains(extents.ets2, lngLat)) {
        xz = fromWgs84ToEts2Coords(lngLat);
      }

      const atsCenterDelta = distance(lngLat, center(extents.ats));
      const ets2CenterDelta = distance(lngLat, center(extents.ets2));
      const closestGame = atsCenterDelta <= ets2CenterDelta ? 'ats' : 'ets2';

      setClickContext({
        position: {
          lngLat,
          xz,
        },
        closestGame,
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

      void map.once('move', closeContextMenu);
    };

    map.on('contextmenu', showContextMenu);
    return () => void map.off('contextmenu', showContextMenu);
  }, [map]);

  useEffect(() => {
    if (!measuring) {
      map.getCanvas().style.cursor = '';
      return;
    }

    let idCounter = 0;
    const newId = () => idCounter++;

    // based on https://maplibre.org/maplibre-gl-js/docs/examples/measure-distances/

    const linestring: GeoJSON.Feature<GeoJSON.LineString, { id: number }> = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: measuringPoints,
      },
      properties: { id: newId() },
    };

    const geojson: GeoJSON.FeatureCollection<
      GeoJSON.Point | GeoJSON.LineString,
      { id: number }
    > = {
      type: 'FeatureCollection',
      features: [
        ...measuringPoints.map(p => point(p, newId())),
        ...(measuringPoints.length > 1 ? [linestring] : []),
      ],
    };

    const setCursor = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['measure-points'],
      });
      // UI indicator for clicking/hovering a point on the map
      const inBounds = contains(
        measuring === 'ats' ? extents.ats : extents.ets2,
        e.lngLat.toArray(),
      );
      map.getCanvas().style.cursor = inBounds
        ? features.length
          ? 'pointer'
          : 'crosshair'
        : 'not-allowed';
    };

    const addOrDeletePoint = (e: MapMouseEvent) => {
      const inBounds = contains(
        measuring === 'ats' ? extents.ats : extents.ets2,
        e.lngLat.toArray(),
      );
      if (!inBounds) {
        return;
      }

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
        // assume only PointFeatures are added to `measure-points`.
        const id = (features[0].properties as { id: number }).id;
        geojson.features = geojson.features.filter(p => p.properties.id !== id);
      } else {
        geojson.features.push(point(e.lngLat.toArray(), newId()));
      }

      if (geojson.features.length > 1) {
        linestring.geometry.coordinates = geojson.features.map(maybePoint => {
          assert(
            maybePoint.geometry.type === 'Point',
            `unexpected non-Point geometry: ${maybePoint.geometry.type}`,
          );
          return (maybePoint as PointFeature).geometry.coordinates;
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
          {clickContext ? (
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
                    fractionDigits={4}
                  />
                </ListItemContent>
                <ContentCopy sx={{ ml: 1 }} />
              </MenuItem>
              {clickContext.position.xz ? (
                <>
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
                        fractionDigits={1}
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
                        setMeasuring(assertExists(clickContext).closestGame);
                        setMeasuringPoints([
                          assertExists(clickContext).position.lngLat,
                        ]);
                      }}
                    >
                      Measure distance
                    </MenuItem>
                  )}
                </>
              ) : (
                <>
                  <ListDivider />
                  <ListItem>
                    <Typography level={'body-xs'} sx={{ opacity: 0.75 }}>
                      Right-click within the{' '}
                      {clickContext.closestGame.toUpperCase()} game map for more
                      options.
                    </Typography>
                  </ListItem>
                </>
              )}
            </>
          ) : null}
        </Menu>
      </div>
      <MeasuringToast
        measuring={measuring}
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
  fractionDigits: number;
}) => {
  return Object.entries(props.coords).map(([label, value], index) => (
    <Fragment key={label}>
      {index > 0 ? <span>&nbsp;&nbsp;</span> : null}
      <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
        {label}
      </Chip>
      {toFixedString(value, props.fractionDigits)}
    </Fragment>
  ));
};

const MeasuringToast = memo(
  (props: {
    measuring: 'ats' | 'ets2' | false;
    measuringPoints: [lon: number, lat: number][];
    close: () => void;
  }) => {
    if (props.measuring === false) {
      return null;
    }

    return (
      <Snackbar
        open={true}
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
              <Stack direction={'row'} gap={2} sx={{ textWrap: 'nowrap' }}>
                <Typography level={'title-sm'}>Total distance:</Typography>
                <Stack direction={'row'} gap={0.5}>
                  <Typography level={'body-xs'}>
                    <Public />
                  </Typography>
                  <Typography level={'title-sm'}>
                    {getDistanceReadout(
                      props.measuringPoints,
                      'irl',
                      props.measuring,
                    )}
                  </Typography>
                </Stack>
                <Stack direction={'row'} gap={0.5}>
                  <Typography level={'body-xs'}>
                    <SportsEsports />
                  </Typography>
                  <Typography level={'title-sm'}>
                    {getDistanceReadout(
                      props.measuringPoints,
                      'game',
                      props.measuring,
                    )}
                  </Typography>
                </Stack>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Snackbar>
    );
  },
);

const CopiedToClipboardToast = memo(
  (props: { open: boolean; close: (reason: SnackbarCloseReason) => void }) => {
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

function toFixed(n: number, fracDigits: number): number {
  return Number(n.toFixed(fracDigits));
}

function toFixedString(n: number, fracDigits: number): string {
  return Number(n.toFixed(fracDigits)).toLocaleString(undefined, {
    maximumFractionDigits: fracDigits,
  });
}

function point(lngLat: [number, number], id: number): PointFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: lngLat,
    },
    properties: {
      id,
    },
  };
}

function getDistanceReadout(
  lngLats: [number, number][],
  type: 'irl' | 'game',
  game: 'ats' | 'ets2',
) {
  let points: [number, number][];
  if (type === 'irl') {
    points = lngLats;
  } else {
    const tx = game === 'ats' ? fromWgs84ToAtsCoords : fromWgs84ToEts2Coords;
    points = lngLats.map(tx);
  }

  const distanceInKm =
    type === 'irl'
      ? distance
      : (a: [number, number], b: [number, number]) =>
          euclideanDistance(a, b) / 1000;

  let prevPoint = points[0];
  let totalDistanceKm = 0;
  for (const curPoint of points.slice(1)) {
    totalDistanceKm += distanceInKm(prevPoint, curPoint);
    prevPoint = curPoint;
  }

  const metricReadout =
    totalDistanceKm < 1
      ? `${toFixedString(totalDistanceKm * 1000, 1)} meters`
      : `${toFixedString(totalDistanceKm, 2)} km`;

  if (type === 'irl') {
    const miles = totalDistanceKm * 0.6213712;
    const imperialReadout =
      miles < 1
        ? `${toFixedString(miles * 5280, 0)} ft`
        : `${toFixedString(miles, 2)} mi`;

    const primary = game === 'ats' ? imperialReadout : metricReadout;
    const secondary = game === 'ats' ? metricReadout : imperialReadout;
    return `${primary} (${secondary})`;
  } else {
    return metricReadout;
  }
}
