import { Brightness6 } from '@mui/icons-material';
import { IconButton, useColorScheme } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { useRef } from 'react';
import { useControl } from 'react-map-gl/maplibre';

export const ModeControl = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { mode, setMode } = useColorScheme();

  useControl(() => ({
    onAdd: () => assertExists(ref.current),
    onRemove: () => assertExists(ref.current).remove(),
  }));

  return (
    <div ref={ref}>
      <div className={'maplibregl-ctrl maplibregl-ctrl-group'}>
        <IconButton
          sx={{
            minWidth: 0,
            minHeight: 0,
            borderRadius: 0,
          }}
          title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        >
          <Brightness6 />
        </IconButton>
      </div>
    </div>
  );
};
