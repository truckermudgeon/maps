import {
  BaseMapStyle,
  defaultMapStyle,
  GameMapStyle,
  SceneryTownSource,
} from '@truckermudgeon/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapGl, {
  AttributionControl,
  FullscreenControl,
  NavigationControl,
} from 'react-map-gl/maplibre';
import { Legend } from './Legend';
import { MapSelectAndSearch } from './MapSelectAndSearch';

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
      mapStyle={defaultMapStyle}
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
      <SceneryTownSource />
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
