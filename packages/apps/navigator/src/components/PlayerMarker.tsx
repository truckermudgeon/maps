import { Navigation } from '@mui/icons-material';
import { Box } from '@mui/joy';
import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import { forwardRef } from 'react';
import { Marker } from 'react-map-gl/maplibre';

/**
 * Setting these props should only be done in storybooks, because callers of
 * PlayerMarker should be using the Marker ref to set its position / rotation.
 */
interface PropsForTestingOnly {
  longitude?: number;
  latitude?: number;
}

export const PlayerMarker = forwardRef<MapLibreGLMarker, PropsForTestingOnly>(
  (props: PropsForTestingOnly, ref) => (
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
          background: 'rgba(255,255,255,0.8)',
          borderRadius: '50%',
          boxShadow: '0 1px 1px 1px rgba(128,128,128,.2)',
        }}
      >
        <Navigation sx={{ transform: 'scale(4)', fill: '#09f' }} />
      </Box>
    </Marker>
  ),
);
