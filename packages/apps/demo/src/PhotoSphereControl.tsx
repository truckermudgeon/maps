import { Vrpano } from '@mui/icons-material';
import { IconButton } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { useCallback, useRef, useState } from 'react';
import { useControl, useMap } from 'react-map-gl/maplibre';

export interface PhotoSphereControlProps {
  onToggle: (newValue: boolean) => void;
}

export const PhotoSphereControl = (props: PhotoSphereControlProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<boolean>(false);
  const map = assertExists(useMap().current);

  useControl(() => ({
    onAdd: () => assertExists(ref.current),
    onRemove: () => assertExists(ref.current).remove(),
  }));

  const togglePhotoSpheres = useCallback(() => {
    setActive(!active);
    props.onToggle(!active);
  }, [active]);

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
            : undefined,
        }}
        variant={active ? 'soft' : 'plain'}
        title={'Browse Photo Spheres'}
        onClick={togglePhotoSpheres}
      >
        <Vrpano />
      </IconButton>
    </div>
  );
};
