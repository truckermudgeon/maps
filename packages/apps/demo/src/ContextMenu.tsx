import { ContentCopy, Public, SportsEsports } from '@mui/icons-material';
import {
  Chip,
  ListDivider,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  Menu,
  MenuItem,
} from '@mui/joy';
import type { VirtualElement } from '@popperjs/core/lib/types';
import { assertExists } from '@truckermudgeon/base/assert';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';

export const ContextMenu = () => {
  const mapRef = useMap();
  const [anchorEl, setAnchorEl] = useState<VirtualElement | null>(null);

  const handleClose = () => {
    console.log('closing!');
    setAnchorEl(null);
  };

  const showContextMenu = (e: MapLayerMouseEvent) => {
    const { clientX, clientY } = e.originalEvent;
    setAnchorEl({
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        top: clientY,
        right: clientX,
        bottom: clientY,
        left: clientX,
      }),
    } as VirtualElement);

    const map = assertExists(mapRef.current);
    void map.once('move', handleClose);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.on('contextmenu', showContextMenu);
    return () => {
      map.off('contextmenu', showContextMenu);
    };
  }, [mapRef, setAnchorEl]);

  return (
    <div
      style={{
        display: anchorEl != null ? 'block' : 'none',
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
          handleClose();
        }
      }}
    >
      <Menu
        size={'sm'}
        onClick={handleClose}
        open={anchorEl != null}
        anchorEl={anchorEl}
        placement={'bottom-start'}
        onContextMenu={e => e.preventDefault()}
      >
        <MenuItem sx={{ justifyContent: 'space-between' }}>
          <ListItem>
            <ListItemDecorator>
              <Public />
            </ListItemDecorator>
            <ListItemContent>
              <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
                lat
              </Chip>
              -45.67
              <span>&nbsp;&nbsp;</span>
              <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
                lng
              </Chip>
              123.456
            </ListItemContent>
          </ListItem>
          <ContentCopy />
        </MenuItem>
        <MenuItem sx={{ justifyContent: 'space-between' }}>
          <ListItem>
            <ListItemDecorator>
              <SportsEsports />
            </ListItemDecorator>
            <ListItemContent>
              <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
                x
              </Chip>
              10,235.5
              <span>&nbsp;&nbsp;</span>
              <Chip size={'sm'} variant={'plain'} sx={{ opacity: 0.4 }}>
                z
              </Chip>
              4,234.2
            </ListItemContent>
          </ListItem>
          <ContentCopy />
        </MenuItem>
        <ListDivider />
        <MenuItem>Share this location</MenuItem>
        <MenuItem>Measure distance</MenuItem>
      </Menu>
      hello
    </div>
  );
};
