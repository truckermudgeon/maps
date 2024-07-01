import { Layer, Source } from 'react-map-gl/maplibre';
import { addPmTilesProtocol } from './pmtiles';

export const BaseMapStyle = () => {
  addPmTilesProtocol();

  return (
    <>
      <Layer
        id={'background'}
        type={'background'}
        paint={{ 'background-color': '#b2cdfb' }}
      />
      <Source id={'world'} type={'vector'} url={'pmtiles:///world.pmtiles'}>
        <Layer
          source-layer={'land'}
          type={'fill'}
          paint={{ 'fill-color': '#f8f8f8' }}
        />
        <Layer
          source-layer={'states'}
          type={'line'}
          paint={{
            'line-color': '#aaa',
            'line-width': 1,
            'line-opacity': 1,
            'line-dasharray': [2, 2],
          }}
        />
        <Layer
          source-layer={'countries'}
          type={'line'}
          paint={{
            'line-color': '#ccc',
            'line-width': 1,
            'line-opacity': 1,
          }}
        />
        <Layer
          source-layer={'lakes'}
          type={'fill'}
          paint={{
            'fill-color': '#b2cdfb',
          }}
        />
      </Source>
    </>
  );
};
