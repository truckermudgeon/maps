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
import { useEffect, useRef, useState } from 'react';
import { useControl, useMap } from 'react-map-gl/maplibre';

const toDecimals = (n: number, decimals: number) => {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
};

export const ShareControl = () => {
  const inputRef = useRef<HTMLInputElement>(null);
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
    const input = inputRef.current;
    if (!map || !input || !open) {
      return;
    }

    const updateUrl = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const query = includeMarker
        ? '?' +
          new URLSearchParams({
            mlat: String(toDecimals(center.lat, 2)),
            mlon: String(toDecimals(center.lng, 2)),
          }).toString()
        : '';
      const hash =
        '#' +
        [
          toDecimals(zoom, 2),
          toDecimals(center.lat, 2),
          toDecimals(center.lng, 2),
        ].join('/');
      setShareUrl(window.location.origin + query + hash);
    };

    updateUrl();

    map.on('moveend', updateUrl);
    return () => void map.off('moveend', updateUrl);
  }, [mapRef, inputRef, open, includeMarker]);

  return (
    <div ref={ref}>
      <div className={'maplibregl-ctrl maplibregl-ctrl-group'}>
        <IconButton title={'Share'} onClick={() => setOpen(true)}>
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
            minHeight: 200,
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
              slotProps={{ input: { ref: inputRef } }}
              onFocus={e => e.target.select()}
              value={shareUrl}
              endDecorator={
                <Button
                  sx={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                  onClick={() => console.log('copy')}
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
