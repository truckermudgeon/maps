import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as pmtiles from 'pmtiles';
import MapGl, {
  AttributionControl,
  FullscreenControl,
  Layer,
  NavigationControl,
  Source,
} from 'react-map-gl/maplibre';
import { BaseMapStyle } from './BaseMapStyle';
import {
  GameMapStyle,
  baseTextLayout,
  baseTextPaint,
  textVariableAnchor,
} from './GameMapStyle';
import { Legend } from './Legend';
import { MapSelectAndSearch } from './MapSelectAndSearch';
import { sceneryTownsUrl } from './SearchBar';

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const Demo = () => {
  return (
    <MapGl
      style={{ width: '100vw', height: '100vh' }} // ensure map fills page
      hash={true}
      minZoom={4}
      maxZoom={15}
      //        maxBounds={[
      //          // TODO calculate this based on pmtiles file header
      //          [-132, 24], // southwest corner (lon, lat)
      //          [-87, 51], // northeast corner (lon, lat)
      //        ]}
      mapStyle={{
        version: 8,
        // can't specify relative urls
        // https://github.com/maplibre/maplibre-gl-js/issues/182
        //sprite: 'http://localhost:5173/sprites',
        sprite: 'https://truckermudgeon.github.io/sprites',
        // free font glyphs, required when adding text-fields.
        // https://github.com/openmaptiles/fonts
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        // sources and layers are empty because they're declared as child
        // components below.
        sources: {},
        layers: [],
      }}
      // start off in vegas
      initialViewState={{
        longitude: -115,
        latitude: 36,
        zoom: 9,
      }}
    >
      <BaseMapStyle />
      <GameMapStyle game={'ats'} />
      <GameMapStyle game={'ets2'} />
      <Source id={`scenery-towns`} type={'geojson'} data={sceneryTownsUrl}>
        <Layer
          id={`scenery-towns`}
          type={'symbol'}
          minzoom={7}
          layout={{
            ...baseTextLayout,
            'text-field': '{name}',
            'text-variable-anchor': textVariableAnchor,
            'text-size': 10.5,
          }}
          paint={baseTextPaint}
        />
      </Source>
      <NavigationControl visualizePitch={true} />
      <FullscreenControl />
      <AttributionControl
        compact={true}
        customAttribution="&copy; Trucker Mudgeon. scenery town data by <a href='https://github.com/nautofon/ats-towns'>nautofon</a>."
      />
      <MapSelectAndSearch />
      <Legend />
    </MapGl>
  );
};

export default Demo;
