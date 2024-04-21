import type { AtsSelectableDlc } from '@truckermudgeon/map/constants';
import { AtsReleasedDlcs } from '@truckermudgeon/map/constants';
import {
  BaseMapStyle,
  GameMapStyle,
  MapIcon,
  SceneryTownSource,
  allIcons,
  defaultMapStyle,
} from '@truckermudgeon/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useState } from 'react';
import MapGl, {
  AttributionControl,
  FullscreenControl,
  NavigationControl,
} from 'react-map-gl/maplibre';
import { Legend } from './Legend';
import { MapSelectAndSearch } from './MapSelectAndSearch';

const Demo = () => {
  const [autoHide, setAutoHide] = useState(true);
  const [visibleIcons, setVisibleIcons] = useState(new Set(allIcons));
  const [visibleAtsDlcs, setVisibleAtsDlcs] = useState(
    new Set(AtsReleasedDlcs),
  );

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
      <GameMapStyle
        game={'ats'}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
      />
      <GameMapStyle
        game={'ets2'}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
      />
      {visibleIcons.has(MapIcon.CityNames) && (
        <SceneryTownSource enableAutoHide={autoHide} />
      )}
      <NavigationControl visualizePitch={true} />
      <FullscreenControl />
      <AttributionControl
        compact={true}
        customAttribution="&copy; Trucker Mudgeon. scenery town data by <a href='https://github.com/nautofon/ats-towns'>nautofon</a>."
      />
      <MapSelectAndSearch />
      <Legend
        enableAutoHiding={autoHide}
        visibleIcons={visibleIcons}
        onAutoHidingToggle={newValue => setAutoHide(newValue)}
        onSelectAllIconsToggle={newValue =>
          setVisibleIcons(new Set(newValue ? allIcons : []))
        }
        onVisibleIconsToggle={(icon: MapIcon, newValue: boolean) => {
          setVisibleIcons(prevState => {
            const newState = new Set(prevState);
            if (newValue) {
              newState.add(icon);
            } else {
              newState.delete(icon);
            }
            return newState;
          });
        }}
        visibleAtsDlcs={visibleAtsDlcs}
        onSelectAllAtsDlcsToggle={newValue =>
          setVisibleAtsDlcs(new Set(newValue ? AtsReleasedDlcs : []))
        }
        onVisibleAtsDlcsToggle={(dlc: AtsSelectableDlc, newValue: boolean) => {
          setVisibleAtsDlcs(prevState => {
            const newState = new Set(prevState);
            if (newValue) {
              newState.add(dlc);
            } else {
              newState.delete(dlc);
            }
            return newState;
          });
        }}
      />
    </MapGl>
  );
};

export default Demo;
