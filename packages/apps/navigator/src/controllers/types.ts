import type { createTRPCProxyClient } from '@trpc/client';
import type { PoiType } from '@truckermudgeon/navigation/constants';
import type { AppRouter, SearchResult } from '@truckermudgeon/navigation/types';
import type { MapAdapter } from '../services/map-adapter';

export type { NavSheetStore } from '../stores/types';

export type AppClient = ReturnType<
  typeof createTRPCProxyClient<AppRouter>
>['app'];

export interface NavSheetController {
  search(query: string): Promise<SearchResult[]>;
  onSearchSelect(queryOrResult: string | SearchResult): void;

  onBackClick(): void;

  onDestinationTypeClick(
    type: PoiType,
    label: string,
    mapAdapter: MapAdapter,
  ): void;

  onDestinationRoutesClick(destination: SearchResult): void;
}
