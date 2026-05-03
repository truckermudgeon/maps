import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as GenerateRoutes from '../generate-routes';

vi.mock('../generate-routes', async importOriginal => {
  const original = await importOriginal<typeof GenerateRoutes>();
  return { ...original, generateRoutes: vi.fn(), addWaypoint: vi.fn() };
});

import type { DomainEventSink } from '../../events';
import type { GraphAndMapData, GraphMappedData } from '../../lookup-data';
import type { RoutingService } from '../generate-routes';
import { addWaypoint, generateRoutes } from '../generate-routes';
import { computePreviewRoutes } from '../preview-routes';
import { aRouteWithIdAndGeometry, aTruckWith } from './builders';

const dummyEventSink: DomainEventSink = { publish: () => void 0 };
const dummyDeps = {
  graphAndMapData: {} as GraphAndMapData<GraphMappedData>,
  routing: {} as RoutingService,
  domainEventSink: dummyEventSink,
};

describe('computePreviewRoutes', () => {
  const toNodeUid = 0xdeadbeefn;
  const truck = aTruckWith({});

  beforeEach(() => {
    vi.mocked(generateRoutes).mockReset();
    vi.mocked(addWaypoint).mockReset();
  });

  describe('without active route', () => {
    it('calls generateRoutes with all 3 strategies', async () => {
      vi.mocked(generateRoutes).mockResolvedValue([]);

      await computePreviewRoutes(
        toNodeUid,
        { activeRoute: undefined, routeIndex: undefined, truck },
        dummyDeps,
      );

      expect(generateRoutes).toHaveBeenCalledWith(
        toNodeUid,
        ['smallRoads', 'shortest', 'fastest'],
        expect.objectContaining({ truck }),
      );
    });

    it('deduplicates routes with identical geometry', async () => {
      const geo: [number, number][] = [
        [0, 0],
        [1, 1],
      ];
      vi.mocked(generateRoutes).mockResolvedValue([
        aRouteWithIdAndGeometry('a', geo),
        aRouteWithIdAndGeometry('b', geo),
      ]);

      const results = await computePreviewRoutes(
        toNodeUid,
        { activeRoute: undefined, routeIndex: undefined, truck },
        dummyDeps,
      );

      expect(results).toHaveLength(1);
    });

    it('preserves routes with distinct geometry', async () => {
      vi.mocked(generateRoutes).mockResolvedValue([
        aRouteWithIdAndGeometry('a', [
          [0, 0],
          [1, 1],
        ]),
        aRouteWithIdAndGeometry('b', [
          [0, 0],
          [2, 2],
        ]),
      ]);

      const results = await computePreviewRoutes(
        toNodeUid,
        { activeRoute: undefined, routeIndex: undefined, truck },
        dummyDeps,
      );

      expect(results).toHaveLength(2);
    });

    it('returns results in reversed order', async () => {
      vi.mocked(generateRoutes).mockResolvedValue([
        aRouteWithIdAndGeometry('first', [
          [0, 0],
          [1, 1],
        ]),
        aRouteWithIdAndGeometry('second', [
          [0, 0],
          [2, 2],
        ]),
      ]);

      const results = await computePreviewRoutes(
        toNodeUid,
        { activeRoute: undefined, routeIndex: undefined, truck },
        dummyDeps,
      );

      expect(results[0].id).toBe('second');
      expect(results[1].id).toBe('first');
    });
  });

  describe('with active route', () => {
    it('calls addWaypoint with auto strategy', async () => {
      const activeRoute = aRouteWithIdAndGeometry('active', [
        [0, 0],
        [1, 1],
      ]);
      const routeIndex = { segmentIndex: 0, stepIndex: 0, nodeIndex: 0 };
      vi.mocked(addWaypoint).mockResolvedValue(
        aRouteWithIdAndGeometry('waypointed', [
          [0, 0],
          [3, 3],
        ]),
      );

      await computePreviewRoutes(
        toNodeUid,
        { activeRoute, routeIndex, truck },
        dummyDeps,
      );

      expect(addWaypoint).toHaveBeenCalledWith(
        toNodeUid,
        activeRoute,
        'auto',
        expect.objectContaining({ routeIndex, truck }),
      );
      expect(generateRoutes).not.toHaveBeenCalled();
    });
  });
});
