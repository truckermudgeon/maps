import { Layer, Source } from 'react-map-gl/maplibre';
import { addPmTilesProtocol } from './pmtiles';

interface ContoursStyleProps {
  game: 'ats' | 'ets2';
  /**
   * URL where .pmtiles are stored, without the trailing `/`, e.g.,
   * `https://truckermudgeon.github.io`
   */
  tileRootUrl: string;
  showContours: boolean;
}
export const ContoursStyle = (props: ContoursStyleProps) => {
  addPmTilesProtocol();
  return (
    <Source
      type={'vector'}
      url={`pmtiles://${props.tileRootUrl}/${props.game}-contours.pmtiles`}
    >
      <Layer
        source-layer={'contours'}
        type={'fill'}
        layout={{
          'fill-sort-key': ['get', 'elevation'],
          visibility: props.showContours ? 'visible' : 'none',
        }}
        paint={{
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'elevation'],
            -200,
            '#77c571',
            0,
            '#77c571',
            100,
            '#afd35f',
            150,
            '#ece75b',
            200,
            '#decb4c',
            250,
            '#d2b446',
            300,
            '#bf9c4a',
            400,
            '#ba8839',
            500,
            '#ac792d',
          ],
        }}
      />
    </Source>
  );
};
