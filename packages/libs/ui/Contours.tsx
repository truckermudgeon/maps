import { Layer, Source } from 'react-map-gl/maplibre';
import { addPmTilesProtocol } from './pmtiles';

interface ContoursStyleProps {
  game: 'ats' | 'ets2';
  showContours: boolean;
}
export const ContoursStyle = (props: ContoursStyleProps) => {
  addPmTilesProtocol();
  return (
    <Source type={'vector'} url={`pmtiles:///${props.game}-contours.pmtiles`}>
      <Layer
        source-layer={'contours'}
        type={'fill'}
        layout={{
          'fill-sort-key': ['get', 'index'],
          visibility: props.showContours ? 'visible' : 'none',
        }}
        paint={{
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'index'],
            1,
            '#77c571',
            200,
            '#77c571',
            300,
            '#afd35f',
            350,
            '#ece75b',
            400,
            '#decb4c',
            450,
            '#d2b446',
            500,
            '#bf9c4a',
            600,
            '#ba8839',
            700,
            '#ac792d',
          ],
        }}
      />
    </Source>
  );
};
