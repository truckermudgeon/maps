import { Box, Link } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { christmasMapStyle, halloweenMapStyle } from '@truckermudgeon/ui';
import { StyleSpecification } from 'maplibre-gl';
import { useRef } from 'react';
import { useControl } from 'react-map-gl/maplibre';

export type SpecialEvent = 'halloween' | 'christmas';

export interface SpecialEventMeta {
  emoji: string;
  mapName: string;
  url: `/${string}`;
  centerLngLat: [number, number];
  boundsDelta: number;
  minZoom: number;
  mapStyle: StyleSpecification;
}

export const eventMeta: Record<SpecialEvent, SpecialEventMeta> = {
  halloween: {
    emoji: '🎃',
    mapName: 'Brackenreach',
    url: '/brackenreach',
    centerLngLat: [-120.6266, 18.5926],
    boundsDelta: 0.5,
    minZoom: 10,
    mapStyle: halloweenMapStyle,
  },
  christmas: {
    emoji: '🎄',
    mapName: 'Winterland',
    url: '/winterland',
    centerLngLat: [-123.075, 13.5243],
    boundsDelta: 1,
    minZoom: 8,
    mapStyle: christmasMapStyle,
  },
};

export const SpecialEventControl = (props: {
  specialEvent?: 'halloween' | 'christmas';
}) => {
  const { specialEvent } = props;
  if (specialEvent == null) {
    return null;
  }

  const ref = useRef<HTMLDivElement>(null);
  useControl(() => ({
    onAdd: () => assertExists(ref.current),
    onRemove: () => assertExists(ref.current).remove(),
    getDefaultPosition: () => 'top-left',
  }));

  const meta = eventMeta[specialEvent];

  return (
    <div ref={ref} style={{ position: 'absolute', top: 0, right: 0 }}>
      <div className={'maplibregl-ctrl maplibregl-ctrl-group'}>
        <Link
          component={'button'}
          underline={'none'}
          title={`Switch to ${meta.mapName} Map`}
          justifyContent={'center'}
          onClick={() => (window.location.href = meta.url)}
          sx={{
            fontSize: '1.75em',
          }}
        >
          <Box>{meta.emoji}</Box>
        </Link>
      </div>
    </div>
  );
};
