import type { Marker as MapLibreGLMarker } from 'maplibre-gl';
import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { MapRef } from 'react-map-gl/maplibre';
import { PlayerMarker } from '../components/PlayerMarker';
import { SlippyMap as SlippyMapComponent } from '../components/SlippyMap';
import type { NavSheetController } from '../controllers/types';
import { useCameraStore } from '../stores/hooks/use-camera';
import { useSessionStore } from '../stores/hooks/use-session';
import { Destinations } from './Destinations';
import { TrailerOrWaypointMarkers } from './TrailerOrWaypointMarkers';

export const SlippyMap = observer(
  (props: {
    initialMap: 'usa' | 'europe';
    onMapLoad: (map: MapRef, marker: MapLibreGLMarker) => void;
    navSheetController: NavSheetController;
  }) => {
    const session = useSessionStore();
    const camera = useCameraStore();
    const map = session.hasReceivedFirstTelemetry
      ? session.map
      : props.initialMap;
    return (
      <SlippyMapComponent
        key={map}
        map={map}
        mode={session.themeMode}
        onLoad={props.onMapLoad}
        onDragStart={action(() => camera.setFree())}
        Destinations={() => (
          <Destinations navSheetController={props.navSheetController} />
        )}
        TrailerOrWaypointMarkers={TrailerOrWaypointMarkers}
        PlayerMarker={PlayerMarker}
      />
    );
  },
);
