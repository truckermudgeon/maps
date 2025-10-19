import { Box, Link } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { useRef } from 'react';
import { useControl } from 'react-map-gl/maplibre';

const eventMeta = {
  halloween: {
    emoji: '🎃',
    mapName: 'Brackenreach',
    url: '/brackenreach',
  },
};

export const SpecialEventControl = (props: { specialEvent?: 'halloween' }) => {
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
