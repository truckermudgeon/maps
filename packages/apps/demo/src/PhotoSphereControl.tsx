import { Vrpano } from '@mui/icons-material';
import { IconButton } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { useCallback, useRef } from 'react';
import { useControl } from 'react-map-gl/maplibre';

export interface PhotoSphereControlProps {
  visible: boolean;
  active: boolean;
  onToggle: (newValue: boolean) => void;
}

export const PhotoSphereControl = (props: PhotoSphereControlProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useControl(() => ({
    onAdd: () => assertExists(ref.current),
    onRemove: () => assertExists(ref.current).remove(),
  }));

  const togglePhotoSpheres = useCallback(() => {
    props.onToggle(!props.active);
  }, [props.active]);

  return (
    <div
      ref={ref}
      className={'maplibregl-ctrl maplibregl-ctrl-group'}
      style={{ display: props.visible ? '' : 'none' }}
    >
      <IconButton
        slots={{ root: IconButton }}
        sx={{
          minWidth: 0,
          minHeight: 0,
          borderRadius: 0,
          backgroundColor: props.active
            ? 'var(--joy-palette-primary-softHoverBg) !important'
            : undefined,
        }}
        variant={props.active ? 'soft' : 'plain'}
        title={'Browse Street View images'}
        onClick={togglePhotoSpheres}
      >
        <Vrpano />
      </IconButton>
    </div>
  );
};
