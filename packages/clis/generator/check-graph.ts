import { findRoute } from '@truckermudgeon/map/routing';
import type { CompanyItem, Neighbors } from '@truckermudgeon/map/types';
import * as cliProgress from 'cli-progress';
import { logger } from './logger';
import type { MappedData } from './mapped-data';

export function checkGraph(
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

  const routeContext = {
    graph,
    nodeLUT: nodes,
  };
  let unrouteableCount = 0;
  for (const company of allCompanies) {
    const pairings = [
      [originCompany, company],
      [company, originCompany],
    ];
    for (const [start, end] of pairings) {
      bar.increment({ start: toString(start), end: toString(end) });
      const route = findRoute(
        start.nodeUid.toString(16),
        end.nodeUid.toString(16),
        'forward',
        'shortest',
        routeContext,
      );
      if (!route) {
        unrouteableCount++;
        logger.warn('no route from', toString(start), 'to', toString(end));
      }
    }
  }

  const endTime = Date.now();
  logger.info(
    allCompanies.length * 2,
    'routes checked in',
    `${((endTime - startTime) / 1000).toFixed(1)}s`,
  );
  logger.info(unrouteableCount, 'unrouteable trips');
}

function toString(company: CompanyItem) {
  return company.token + '.' + company.cityToken;
}
