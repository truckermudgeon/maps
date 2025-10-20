import { Box, Link, useColorScheme } from '@mui/joy';
import { assertExists } from '@truckermudgeon/base/assert';
import { GameMapStyle, modeColors } from '@truckermudgeon/ui';
import Color from 'color';
import { useRef } from 'react';
import MapGl, {
  FullscreenControl,
  Layer,
  NavigationControl,
  useControl,
} from 'react-map-gl/maplibre';
import { ModeControl } from './ModeControl';
import { eventMeta } from './SpecialEventControl';

export const SpecialEventMap = (props: {
  tileRootUrl: string;
  specialEvent: 'halloween' | 'christmas';
}) => {
  const { tileRootUrl, specialEvent } = props;
  const { mode: _maybeMode = 'light', systemMode = 'light' } = useColorScheme();
  const mode = _maybeMode === 'system' ? systemMode : _maybeMode;

  const map = ensureValidMapValue(localStorage.getItem('tm-map'));
  const worldEmoji = map === 'usa' ? '🌎' : '🌍';

  const colors = modeColors[mode];
  const meta = eventMeta[specialEvent];
  const [longitude, latitude] = meta.centerLngLat;
  return (
    <MapGl
      style={{
        width: '100svw',
        height: '100svh',
      }}
      minZoom={meta.minZoom}
      maxZoom={15}
      mapStyle={meta.mapStyle}
      attributionControl={false}
      initialViewState={{
        longitude,
        latitude,
        zoom: meta.minZoom + 0.5,
      }}
      maxBounds={[
        [longitude - meta.boundsDelta, latitude - meta.boundsDelta],
        [longitude + meta.boundsDelta, latitude + meta.boundsDelta],
      ]}
    >
      <Layer
        id={'background'}
        type={'background'}
        paint={{
          'background-color': Color(colors.land).darken(0.2).toString(),
        }}
      />
      <GameMapStyle
        tileRootUrl={tileRootUrl}
        game={'ats'}
        specialEvent={specialEvent}
        mode={mode}
        showSecrets={true}
        enableIconAutoHide={false}
      />
      <NavigationControl visualizePitch={true} />
      <FullscreenControl containerId={'fsElem'} />
      <ModeControl />
      <SwitchControl
        emoji={worldEmoji}
        onClick={() => (window.location.href = '/')}
      />
    </MapGl>
  );
};

const SwitchControl = (props: { emoji: string; onClick: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useControl(() => ({
    onAdd: () => assertExists(ref.current),
    onRemove: () => assertExists(ref.current).remove(),
  }));

  return (
    <div ref={ref} style={{ position: 'absolute', top: 10, right: 52 }}>
      <div className={'maplibregl-ctrl maplibregl-ctrl-group'}>
        <Link
          component={'button'}
          underline={'none'}
          title={`Switch to ATS/ETS2 Map`}
          justifyContent={'center'}
          onClick={() => (window.location.href = '/')}
          sx={{
            fontSize: '1.75em',
          }}
        >
          <Box>{props.emoji}</Box>
        </Link>
      </div>
    </div>
  );
};

function ensureValidMapValue(
  maybeMap: string | null | undefined,
): 'usa' | 'europe' {
  return maybeMap === 'europe' ? maybeMap : 'usa';
}
