import path from 'node:path';
import url from 'node:url';
import { readGraphAndMapData } from '../../../infra/lookups/graph-and-map';
import type { GraphAndMapData, GraphMappedData } from '../../lookup-data';

export class TestLookupService {
  private readonly graphAndMapData: GraphAndMapData<GraphMappedData>;

  constructor(map: 'usa' | 'europe') {
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const outDir = path.join(__dirname, '../../../../../../out');
    this.graphAndMapData = readGraphAndMapData(outDir, map);
  }

  getData(): { graphAndMapData: GraphAndMapData<GraphMappedData> } {
    return { graphAndMapData: this.graphAndMapData };
  }
}

export const testLookupService = (map: 'usa' | 'europe' = 'usa') =>
  new TestLookupService(map);
