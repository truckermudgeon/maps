import { Box, Link, useColorScheme } from '@mui/joy';
import {
  GameMapStyle,
  halloweenMapStyle,
  modeColors,
} from '@truckermudgeon/ui';
import Color from 'color';
import MapGl, {
  FullscreenControl,
  Layer,
  NavigationControl,
} from 'react-map-gl/maplibre';
import { ModeControl } from './ModeControl';

export const SpecialEventMap = (props: {
  tileRootUrl: string;
  specialEvent: 'halloween';
}) => {
  const { tileRootUrl, specialEvent } = props;
  const { mode: _maybeMode, systemMode } = useColorScheme();
  const mode =
    _maybeMode === 'system' ? (systemMode ?? 'light') : (_maybeMode ?? 'light');

  const map = ensureValidMapValue(localStorage.getItem('tm-map'));
  const worldEmoji = map === 'usa' ? '🌎' : '🌍';

  const colors = modeColors[mode];
  const [longitude, latitude] = [-120.6266, 18.5926];
  return (
    <MapGl
      style={{
        width: '100svw',
        height: '100svh',
      }}
      minZoom={10}
      maxZoom={15}
      mapStyle={halloweenMapStyle}
      attributionControl={false}
      initialViewState={{
        longitude,
        latitude,
        zoom: 10.5,
      }}
      maxBounds={[
        [longitude - 0.5, latitude - 0.5],
        [longitude + 0.5, latitude + 0.5],
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
      <div style={{ position: 'absolute', top: 10, right: 52 }}>
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
            <Box>{worldEmoji}</Box>
          </Link>
        </div>
      </div>
    </MapGl>
  );
};

function ensureValidMapValue(
  maybeMap: string | null | undefined,
): 'usa' | 'europe' {
  return maybeMap === 'europe' ? maybeMap : 'usa';
}
