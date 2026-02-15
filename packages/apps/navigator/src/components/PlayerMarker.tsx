import { Navigation } from '@mui/icons-material';
import { Box } from '@mui/joy';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import type { RefAttributes } from 'react';
import { forwardRef } from 'react';
import { Marker } from 'react-map-gl/maplibre';

export interface PlayerMarkerProps extends RefAttributes<MapLibreGLMarker> {
  mode?: 'light' | 'dark';
}

/**
 * Setting these props should only be done in storybooks, because callers of
 * PlayerMarker should be using the Marker ref to set its position / rotation.
 */
export interface PropsForTestingOnly {
  longitude?: number;
  latitude?: number;
}

const colors = {
  ['light']: {
    background: 'rgba(255,255,255,0.9)',
    fill: 'hsl(204,100%,50%)',
  },
  ['dark']: {
    background: 'hsl(204,100%,50%)',
    fill: 'rgba(255,255,255,1)',
  },
};

export const PlayerMarker = forwardRef<
  MapLibreGLMarker,
  PlayerMarkerProps & PropsForTestingOnly
>((props: PlayerMarkerProps & PropsForTestingOnly, ref) => {
  const { mode = 'light' } = props;
  const { background, fill } = colors[mode];
  return (
    <Marker
      ref={ref}
      longitude={props.longitude ?? 0}
      latitude={props.latitude ?? 0}
      pitchAlignment={'map'}
      rotationAlignment={'map'}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background,
          borderRadius: '50%',
          boxShadow: '0 1px 1px 1px rgba(128,128,128,.2)',
        }}
      >
        <Navigation
          sx={{
            transform: 'scale(2)',
            fill,
          }}
        />
      </Box>
    </Marker>
  );
});
