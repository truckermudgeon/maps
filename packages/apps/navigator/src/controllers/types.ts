import type { createTRPCProxyClient } from '@trpc/client';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import type { AppRouter, SearchResult } from '@truckermudgeon/navigation/types';
import type { Marker } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import type { CameraStore, RouteStore, SessionStore } from '../stores/types';

export type { NavSheetStore } from '../stores/types';

export type AppClient = ReturnType<
  typeof createTRPCProxyClient<AppRouter>
>['app'];

export interface AppStore extends SessionStore, CameraStore, RouteStore {}

export interface AppController {
  onMapLoad(map: MapRef, playerMarker: Marker): void;

  setFree(): void;
  setFollow(): void;

  addMapDragEndListener(
    cb: (centerLngLat: [number, number]) => void,
  ): () => void;
}

export type CompassPoint = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export interface ControlsStore {
  // (-180, 180] CW, 0 is north.
  bearing: number;
  limit: number;
  speed: number;
  readonly units: 'imperial' | 'metric';
  readonly showRecenterFab: boolean;
  readonly showRouteFab: boolean;
  readonly showSearchFab: boolean;
}

export interface NavSheetController {
  search(query: string): Promise<SearchResult[]>;
  onSearchSelect(queryOrResult: string | SearchResult): void;

  onBackClick(): void;

  onDestinationTypeClick(
    type: PoiType,
    label: string,
    appController: AppController,
  ): void;

  onDestinationRoutesClick(destination: SearchResult): void;
}

export interface Breakpoints {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
}

export interface UIEnvironmentStore {
  readonly breakpoints: Breakpoints;
  readonly width: number;
  readonly height: number;
  readonly orientation: 'portrait' | 'landscape';
  readonly isLargePortrait: boolean;

  // other potential fields
  // isTouchMobile;
  // isDesktopPointer;
  // isKeyboardOpen;
}

export interface MapPaddingStore {
  readonly padding: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
  readonly offset: [number, number];
}
