import { IosShare } from '@mui/icons-material';
import {
  Button,
  Checkbox,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Input,
  ModalClose,
  Sheet,
  Typography,
} from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import type { LngLatLike } from 'maplibre-gl';
import { Marker as MapLibreGLMarker } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { useControl, useMap } from 'react-map-gl/maplibre';

const toDecimals = (n: number, decimals: number) => {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
};

export const ShareControl = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [includeMarker, setIncludeMarker] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string>(window.location.origin);

  const mapRef = useMap();
  useControl(() => ({
    onAdd: () => assertExists(ref.current),
    onRemove: () => assertExists(ref.current).remove(),
  }));

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !open) {
      return;
    }

    const updateUrl = () => {
      const center = map.getCenter();
      const bearing = map.getBearing();
      const pitch = map.getPitch();
      const bnp = bearing || pitch ? [bearing, pitch] : [];
      const zoom = map.getZoom();

      const query = marker
        ? '?' +
          new URLSearchParams({
            mlat: String(toDecimals(marker.getLngLat().lat, 2)),
            mlon: String(toDecimals(marker.getLngLat().lng, 2)),
          }).toString()
        : '';
      const hash =
        '#' +
        [zoom, center.lat, center.lng, ...bnp]
          .map(n => toDecimals(n, 2))
          .join('/');
      setShareUrl(window.location.origin + query + hash);
    };

    let marker: MapLibreGLMarker | undefined;
    let syncMarkerToMap: ((lngLatLike: LngLatLike) => void) | undefined;
    if (includeMarker) {
      marker = new MapLibreGLMarker();
      marker.setLngLat(map.getCenter()).setDraggable(true).addTo(map.getMap());

      let shouldSyncMarkerToMap = true;
      syncMarkerToMap = () =>
        shouldSyncMarkerToMap && marker!.setLngLat(map.getCenter());
      marker.on('dragend', () => {
        shouldSyncMarkerToMap = false;
        map.easeTo({ center: marker?.getLngLat() });
        void map.once('moveend', () => (shouldSyncMarkerToMap = true));
      });
    }

    updateUrl();

    map.on('moveend', updateUrl);
    syncMarkerToMap && map.on('move', syncMarkerToMap);

    return () => {
      map.off('moveend', updateUrl);
      syncMarkerToMap && map.off('move', syncMarkerToMap);
      marker?.remove();
    };
  }, [mapRef, open, includeMarker]);

  return (
    <div ref={ref}>
      <div className={'maplibregl-ctrl maplibregl-ctrl-group'}>
        <IconButton
          sx={{
            minWidth: 0,
            minHeight: 0,
          }}
          title={'Share'}
          onClick={() => setOpen(!open)}
        >
          <IosShare />
        </IconButton>
      </div>
      <Drawer
        open={open}
        anchor={'right'}
        onClose={() => setOpen(false)}
        variant={'plain'}
        hideBackdrop={true}
        slotProps={{
          root: {
            sx: {
              pointerEvents: 'none',
            },
          },
          content: {
            sx: {
              bgcolor: 'transparent',
              p: 1,
              boxShadow: 'none',
              // make sure regular map controls are still visible
              right: open ? 48 : 0,
            },
          },
        }}
      >
        <Sheet
          variant={'outlined'}
          sx={{
            pointerEvents: 'auto',
            borderRadius: 'md',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflow: 'auto',
          }}
        >
          <DialogTitle>Share</DialogTitle>
          <ModalClose />
          <Divider />
          <DialogContent
            sx={{
              gap: 2,
              overflow: 'hidden',
              flexGrow: 1,
              justifyContent: 'center',
            }}
          >
            <Typography>Share a link to this map</Typography>
            <Input
              readOnly
              sx={{ '--Input-decoratorChildHeight': '36px' }}
              onFocus={e => e.target.select()}
              value={shareUrl}
              endDecorator={
                <Button
                  sx={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(shareUrl)
                      .catch(() => alert('Could not copy to clipboard 🙁'))
                  }
                >
                  Copy
                </Button>
              }
            />
            <Checkbox
              label={'Include marker'}
              checked={includeMarker}
              onChange={e => setIncludeMarker(e.target.checked)}
            />
          </DialogContent>
        </Sheet>
      </Drawer>
    </div>
  );
};
