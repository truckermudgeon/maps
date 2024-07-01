import { Layer, Source } from 'react-map-gl/maplibre';
import { modeColors } from './colors';
import { addPmTilesProtocol } from './pmtiles';

interface BaseMapStyleProps {
  mode?: 'dark' | 'light';
}

export const BaseMapStyle = (props: BaseMapStyleProps) => {
  addPmTilesProtocol();
  const { mode = 'light' } = props;
  const colors = modeColors[mode];

  return (
    <>
      <Layer
        id={'background'}
        type={'background'}
        paint={{ 'background-color': colors.water }}
      />
      <Source id={'world'} type={'vector'} url={'pmtiles:///world.pmtiles'}>
        <Layer
          source-layer={'land'}
          type={'fill'}
          paint={{ 'fill-color': colors.land }}
        />
        <Layer
          source-layer={'states'}
          type={'line'}
          paint={{
            'line-color': colors.stateBorder,
            'line-width': 1,
            'line-opacity': 1,
            'line-dasharray': [2, 2],
          }}
        />
        <Layer
          source-layer={'countries'}
          type={'line'}
          paint={{
            'line-color': colors.countryBorder,
            'line-width': 1,
            'line-opacity': 1,
          }}
        />
        <Layer
          source-layer={'lakes'}
          type={'fill'}
          paint={{
            'fill-color': colors.water,
          }}
        />
      </Source>
    </>
  );
};
