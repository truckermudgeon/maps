import { Vrpano } from '@mui/icons-material';
import { IconButton } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { useRef, useState } from 'react';
import { useControl } from 'react-map-gl/maplibre';

export const PhotoSphereControl = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<boolean>(false);

  useControl(() => ({
    onAdd: () => assertExists(ref.current),
    onRemove: () => assertExists(ref.current).remove(),
  }));

  return (
    <div ref={ref} className={'maplibregl-ctrl maplibregl-ctrl-group'}>
      <IconButton
        slots={{ root: IconButton }}
        sx={{
          minWidth: 0,
          minHeight: 0,
          borderRadius: 0,
          backgroundColor: active
            ? 'var(--joy-palette-primary-softHoverBg) !important'
            : undefined, //'var(--joy-palette-background-surface)',
        }}
        variant={active ? 'soft' : 'plain'}
        title={'Browse Photo Spheres'}
        onClick={() => setActive(!active)}
      >
        <Vrpano />
      </IconButton>
    </div>
  );
};
