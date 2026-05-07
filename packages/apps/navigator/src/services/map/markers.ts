import { Preconditions } from '@truckermudgeon/base/precon';
import { Marker } from 'maplibre-gl';
import type { MapHandle } from './handle';

interface Pose {
  position: [number, number];
  bearing: number;
}

/**
 * Owns the player marker and the draggable choose-on-map marker
 * lifecycles.
 */
export class MapMarkers {
  private chooseOnMapUi:
    | { marker: Marker; unsubscribeOnMove: () => void }
    | undefined;
  // Tracked so MapCamera can interpolate from the last-set pose
  // smoothly across FREE -> FOLLOW transitions.
  private lastPlayerPose: Pose | undefined;

  constructor(private readonly handle: MapHandle) {}

  /**
   * Sets the player marker's position and bearing in one call. No-ops
   * if the marker hasn't loaded yet.
   */
  setPlayerPose(position: [number, number], bearing: number): void {
    const marker = this.handle.getPlayerMarker();
    if (!marker) {
      return;
    }
    marker.setLngLat(position);
    marker.setRotation(bearing);
    this.lastPlayerPose = {
      position: [position[0], position[1]],
      bearing,
    };
  }

  /** @internal — read by MapCamera.beginFollowCamera. */
  getLastPlayerPose(): Pose | undefined {
    return this.lastPlayerPose;
  }

  /**
   * Clears the cached last-pose so the next follow-camera tick snaps
   * instead of interpolating. Called by the playback loop's stop()
   * so a later restart doesn't tween from a stale pose.
   */
  clearLastPlayerPose(): void {
    this.lastPlayerPose = undefined;
  }

  /**
   * Toggles the draggable "choose on map" marker — a centered Marker
   * that follows the map center as the user pans. Use
   * {@link getChooseOnMapMarkerLngLat} to read the chosen position
   * before toggling off.
   */
  toggleChooseOnMapMarker(enable: boolean): void {
    if (!enable) {
      if (!this.chooseOnMapUi) {
        return;
      }
      this.chooseOnMapUi.marker.remove();
      this.chooseOnMapUi.unsubscribeOnMove();
      this.chooseOnMapUi = undefined;
      return;
    }
    Preconditions.checkState(this.chooseOnMapUi == null);
    const map = Preconditions.checkExists(this.handle.getMap());
    const marker = new Marker()
      .setLngLat(map.getCenter())
      .setDraggable(false)
      .addTo(map.getMap());
    const subscription = map.on('move', () =>
      marker.setLngLat(map.getCenter()),
    );
    this.chooseOnMapUi = {
      marker,
      unsubscribeOnMove: () => subscription.unsubscribe(),
    };
  }

  getChooseOnMapMarkerLngLat(): [number, number] {
    Preconditions.checkState(this.chooseOnMapUi != null);
    return this.chooseOnMapUi.marker.getLngLat().toArray();
  }
}
