import type { PropsWithChildren } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';
import type { Mode } from './colors';
import { modeColors } from './colors';
import { addPmTilesProtocol } from './pmtiles';

interface BaseMapStyleProps extends PropsWithChildren {
  /**
   * URL where .pmtiles are stored, without the trailing `/`, e.g.,
   * `https://truckermudgeon.github.io`
   */
  tileRootUrl: string;
  mode?: Mode;
}

export const BaseMapStyle = (props: BaseMapStyleProps) => {
  addPmTilesProtocol();
  const { mode = 'light', children, tileRootUrl } = props;
  const colors = modeColors[mode];

  return (
    <>
      <Layer
        id={'background'}
        type={'background'}
        paint={{ 'background-color': colors.land }}
      />
      <Source
        id={'world'}
        type={'vector'}
        url={`pmtiles://${tileRootUrl}/world.pmtiles`}
      >
        <Layer
          source-layer={'water'}
          type={'fill'}
          paint={{ 'fill-color': colors.water }}
        />
        {children}
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
          filter={['!=', ['get', 'name'], 'Serbia-Kosovo']}
          paint={{
            'line-color': colors.countryBorder,
            'line-width': 2,
            'line-opacity': 1,
          }}
        />
        <Layer
          source-layer={'countries'}
          type={'line'}
          filter={['==', ['get', 'name'], 'Serbia-Kosovo']}
          paint={{
            'line-color': colors.countryBorder,
            'line-width': 2,
            'line-opacity': 1,
            'line-dasharray': [3, 2],
          }}
        />
      </Source>
    </>
  );
};
