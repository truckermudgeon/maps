import {
  AtsSelectableDlcs,
  toAtsDlcGuards,
} from '@truckermudgeon/map/constants';
import { fromAtsCoordsToWgs84 } from '@truckermudgeon/map/projections';
import type { Route } from '@truckermudgeon/map/routing';
import type { CompanyItem, Neighbors } from '@truckermudgeon/map/types';
import * as cliProgress from 'cli-progress';
import Tinypool from 'tinypool';
import { logger } from '../logger';
import type { MappedData } from '../mapped-data';

interface CompanySummary {
  company: string;
  nodeUid: bigint;
  latLng: string;
}

interface Unrouteable {
  numIters: number;
  start: CompanySummary;
  end: CompanySummary;
}

export async function checkGraph(
  graph: Map<string, Neighbors>,
  tsMapData: MappedData,
) {
  const { nodes, companies, prefabs } = tsMapData;

  // check that all companies can be reached from some random company.
  const allCompanies = [...companies.values()].filter(company =>
    prefabs.has(company.prefabUid.toString(16)),
  );
  const originCompany =
    allCompanies[Math.floor(Math.random() * allCompanies.length)];

  logger.start(
    'checking',
    allCompanies.length * 2,
    `routes against ${toString(originCompany)}`,
  );
  const startTime = Date.now();
  const bar = new cliProgress.SingleBar(
    {
      format: `[{bar}] | {start} => {end}`,
      stopOnComplete: true,
      clearOnComplete: true,
    },
    cliProgress.Presets.rect,
  );
  bar.start(allCompanies.length * 2, 0);

  const pool = new Tinypool({
    filename: new URL('./find-route-worker-wrapper.js', import.meta.url).href,
    workerData: {
      routeContext: {
        graph,
        nodeLUT: nodes,
        enabledDlcGuards: toAtsDlcGuards(AtsSelectableDlcs),
      },
    },
  });
  const promises: Promise<unknown>[] = [];
  const unrouteable: Unrouteable[] = [];
  for (const company of allCompanies) {
    const pairings = [
      [originCompany, company],
      [company, originCompany],
    ];
    for (const [start, end] of pairings) {
      promises.push(
        pool
          .run({
            startNodeUid: start.nodeUid.toString(16),
            endNodeUid: end.nodeUid.toString(16),
          })
          .then((route: Route) => {
            if (!route.success) {
              unrouteable.push({
                numIters: route.numIters,
                start: toSummary(start),
                end: toSummary(end),
              });
            }
          })
          .finally(() => {
            bar.increment({ start: toString(start), end: toString(end) });
          }),
      );
    }
  }
  await Promise.all(promises);
  await pool.destroy();

  const endTime = Date.now();
  logger.info(
    allCompanies.length * 2,
    'routes checked in',
    `${((endTime - startTime) / 1000).toFixed(1)}s`,
  );
  logger.warn(unrouteable.length, 'unrouteable trips\n', unrouteable);
}

function toSummary(c: CompanyItem): CompanySummary {
  const [lng, lat] = fromAtsCoordsToWgs84([c.x, c.y]).map(v => v.toFixed(3));
  return {
    company: toString(c),
    nodeUid: c.nodeUid,
    latLng: `/${lat}/${lng}`,
  };
}

function toString(company: CompanyItem) {
  return company.token + '.' + company.cityToken;
}
