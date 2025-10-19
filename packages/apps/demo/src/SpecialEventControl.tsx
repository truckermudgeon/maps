import { IconButton } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { useRef } from 'react';
import { useControl, useMap } from 'react-map-gl/maplibre';

export const SpecialEventControl = (props: { specialEvent?: 'halloween' }) => {
  if (props.specialEvent == null) {
    return null;
  }

  const ref = useRef<HTMLDivElement>(null);

  const mapRef = useMap();
  useControl(() => ({
    onAdd: () => assertExists(ref.current),
    onRemove: () => assertExists(ref.current).remove(),
    getDefaultPosition: () => 'top-left',
  }));

  return (
    <div ref={ref} style={{ position: 'absolute', top: 0, right: 0 }}>
      <div className={'maplibregl-ctrl maplibregl-ctrl-group'}>
        <IconButton
          sx={{
            minWidth: 0,
            minHeight: 0,
            borderRadius: 0,
            fontSize: '1.7em',
          }}
          title={'Switch to Brackenreach Map'}
        >
          🎃
        </IconButton>
      </div>
    </div>
  );
};
