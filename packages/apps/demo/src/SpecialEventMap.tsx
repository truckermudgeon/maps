import { Box, Link, useColorScheme } from '@mui/joy';
import { GameMapStyle, modeColors } from '@truckermudgeon/ui';
import Color from 'color';
import MapGl, {
  FullscreenControl,
  Layer,
  NavigationControl,
} from 'react-map-gl/maplibre';
import { ModeControl } from './ModeControl';
import { eventMeta } from './SpecialEventControl';

export const SpecialEventMap = (props: {
  tileRootUrl: string;
  specialEvent: 'halloween' | 'christmas';
}) => {
  const { tileRootUrl, specialEvent } = props;
  const { mode: _maybeMode, systemMode } = useColorScheme();
  const mode =
    _maybeMode === 'system' ? (systemMode ?? 'light') : (_maybeMode ?? 'light');

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
