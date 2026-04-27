import { beforeAll } from 'vitest';
import type { GraphAndMapData, GraphMappedData } from '../../lookup-data';
import { testLookupService } from './test-lookup-service';

describe('RouteStepBuilder', () => {
  let graphAndMapData: GraphAndMapData<GraphMappedData>;
  beforeAll(() => {
    graphAndMapData = testLookupService('europe').getData().graphAndMapData;
  });

  it('builds steps including prefab roundabouts', () => {
    //
  });
});
