import { ContentCopy, Public, SportsEsports } from '@mui/icons-material';
import {
  Chip,
  ListDivider,
  ListItem,
  ListItemContent,
  Menu,
  MenuItem,
} from '@mui/joy';
import type { VirtualElement } from '@popperjs/core/lib/types';
import { assertExists } from '@truckermudgeon/base/assert';
import { fromWgs84ToAtsCoords } from '@truckermudgeon/map/projections';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';

interface Context {
  anchorEl: VirtualElement;
  position?: {
    lngLat: [string, string];
    xz: [string, string];
  };
}

const toFixed = (f: number, tuple: [number, number]): [string, string] =>
  tuple.map(v => Number(v.toFixed(f)).toLocaleString()) as [string, string];

export const ContextMenu = () => {
  const mapRef = useMap();
  const [context, setContext] = useState<Context | null>(null);

  const closeContextMenu = () => setContext(null);

  const showContextMenu = (e: MapLayerMouseEvent) => {
    const { clientX, clientY } = e.originalEvent;
    const lngLat = e.lngLat.toArray();
    const xz = fromWgs84ToAtsCoords(lngLat);

    setContext({
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

    const map = assertExists(mapRef.current);
    void map.once('move', closeContextMenu);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.on('contextmenu', showContextMenu);
    return () => void map.off('contextmenu', showContextMenu);
  }, [mapRef, setContext]);

  return (
    <div
      style={{
        display: context != null ? 'block' : 'none',
        zIndex: 10,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
      onMouseDown={e => {
        if (e.currentTarget === e.target) {
          // only close if user mousedowns on this click-away div. this prevents
          // us from prematurely closing on mousedowns to menu items.
          closeContextMenu();
        }
      }}
    >
      <Menu
        size={'sm'}
        onClick={closeContextMenu}
        open={context != null}
        anchorEl={context?.anchorEl}
        placement={'bottom-start'}
        onContextMenu={e => e.preventDefault()}
      >
        {context?.position ? (
          <>
            <MenuItem sx={{ justifyContent: 'space-between' }}>
              <Public />
              <ListItemContent>
                <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
                  lat
                </Chip>
                {context.position.lngLat[1]}
                <span>&nbsp;&nbsp;</span>
                <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
                  lng
                </Chip>
                {context.position.lngLat[0]}
              </ListItemContent>
              <ContentCopy sx={{ ml: 1 }} />
            </MenuItem>
            <MenuItem sx={{ justifyContent: 'space-between' }}>
              <SportsEsports />
              <ListItemContent>
                <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
                  x
                </Chip>
                {context.position.xz[0]}
                <span>&nbsp;&nbsp;</span>
                <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
                  z
                </Chip>
                {context.position.xz[1]}
              </ListItemContent>
              <ContentCopy sx={{ ml: 1 }} />
            </MenuItem>
            <ListDivider />
            <MenuItem>Share this location</MenuItem>
            <MenuItem>Measure distance</MenuItem>
          </>
        ) : (
          <ListItem>Share this location</ListItem>
        )}
      </Menu>
    </div>
  );
};
