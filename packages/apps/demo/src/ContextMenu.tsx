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
import { assertExists } from '@truckermudgeon/base/assert';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { fromWgs84ToAtsCoords } from '@truckermudgeon/map/projections';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import { memo, useCallback, useEffect, useState } from 'react';
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

export const ContextMenu = () => {
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

  const closeContextMenu = () => setClickContext(null);

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

    void map.once('move', closeContextMenu);
  };

  useEffect(() => {
    map.on('contextmenu', showContextMenu);
    return () => void map.off('contextmenu', showContextMenu);
  }, [map]);

  console.log('render ContextMenu');

  useEffect(() => {
    console.log('measuring points effect');
    return () => {
      console.log('measuring points cleanup');
    };
  }, [map, measuringPoints]);

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
        map={map}
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
    <>
      {index > 0 ? <span>&nbsp;&nbsp;</span> : null}
      <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
        {label}
      </Chip>
      {value.toLocaleString()}
    </>
  ));
};

const MeasuringToast = memo(
  (props: {
    map: NonNullable<ReturnType<typeof useMap>['current']>;
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
              Click on the map to trace a path you want to measure
            </Typography>
          ) : (
            <Stack gap={2}>
              <Typography level={'body-sm'}>
                Click on the map to add to your path
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
    console.log('render clipboard toast', props);
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
        Copied to clipboard
      </Snackbar>
    );
  },
);
