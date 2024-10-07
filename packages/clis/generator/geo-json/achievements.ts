import { assert, assertExists } from '@truckermudgeon/base/assert';
import { putIfAbsent } from '@truckermudgeon/base/map';
import { UnreachableError } from '@truckermudgeon/base/precon';
import {
  type AtsCountryId,
  AtsCountryIdToDlcGuard,
  AtsDlcGuards,
  ItemType,
} from '@truckermudgeon/map/constants';
import type {
  Achievement,
  AchievementFeature,
  CompanyItem,
  Cutscene,
  Trigger,
  WithToken,
} from '@truckermudgeon/map/types';
import { normalizeDlcGuards } from '../dlc-guards';
import { logger } from '../logger';
import type { MappedData } from '../mapped-data';
import { createNormalizeFeature } from './normalize';

interface Point {
  coordinates: { x: number; y: number };
  dlcGuard: number;
}

export function convertToAchievementsGeoJson(
  map: 'usa' | 'europe',
  tsMapData: MappedData,
) {
  const {
    nodes,
    achievements,
    prefabs,
    cities,
    triggers,
    cutscenes,
    countries,
    companies,
    ferries,
    routes,
    trajectories,
  } = tsMapData;
  const dlcGuardQuadTree = assertExists(
    normalizeDlcGuards(
      tsMapData.roads,
      prefabs,
      tsMapData.mapAreas,
      triggers,
      cutscenes,
      tsMapData.pois,
      {
        map,
        nodes,
      },
    ),
  );
  const getDlcGuard = ({ x, y }: { x: number; y: number }): number => {
    const g = dlcGuardQuadTree.find(x, y)?.dlcGuard ?? -1;
    if (g == -1) {
      logger.warn('-1 dlc guard!');
    }
    return g;
  };

  const cityTokenToPoint = (t: string): Point => {
    const city = assertExists(cities.get(t), `city ${t} does not exist`);
    const cityArea = assertExists(city.areas.find(a => !a.hidden));
    const country = assertExists(countries.get(city.countryToken));
    return {
      coordinates: {
        x: city.x + cityArea.width / 2,
        y: city.y + cityArea.height / 2,
      },
      dlcGuard: getDlcGuard(country),
    };
  };
  const cityAndCompanyTokensToPoint = (
    cityToken: string,
    companyToken: string,
  ): Point | undefined => {
    const company = companies
      .values()
      .find(
        c =>
          (c as WithToken<CompanyItem>).token === companyToken &&
          c.cityToken === cityToken,
      );
    if (!company) {
      return;
    }
    const node = assertExists(nodes.get(company.nodeUid.toString(16)));
    return {
      coordinates: node,
      dlcGuard: getDlcGuard(node),
    };
  };
  const triggerAchievementToPoints = (
    achievement: Achievement & { type: 'triggerData' },
  ): Point[] => {
    const achievementTriggers = new Map<string, Trigger[]>();
    const achievementCutscenes = new Map<string, Cutscene[]>();
    for (const item of [...triggers.values(), ...cutscenes.values()]) {
      if (item.type === ItemType.Trigger) {
        const actions = new Map(item.actions);
        if (actions.has('achievement')) {
          const params = assertExists(actions.get('achievement'));
          const name = params[0];
          putIfAbsent(name, [], achievementTriggers).push(item);
        }
      } else if (
        item.type === ItemType.Cutscene &&
        item.actionStringParams.find(s => s.startsWith('achievement 0'))
      ) {
        const name = item.actionStringParams
          .find(s => s.startsWith('achievement 0'))
          ?.split(' ')[2];
        if (name) {
          putIfAbsent(name, [], achievementCutscenes).push(item);
        }
      }
    }

    const { param } = achievement;
    const triggerItems =
      achievementTriggers.get(param) ?? achievementCutscenes.get(param) ?? [];
    return triggerItems.map(item => {
      // TODO use other points in Trigger to draw a circle or polygon
      const firstNodeUid =
        item.type === ItemType.Trigger ? item.nodeUids[0] : item.nodeUid;
      const node = assertExists(nodes.get(firstNodeUid.toString(16)));
      return {
        coordinates: node,
        dlcGuard: getDlcGuard(item),
      };
    });
  };
  const ferryAchievementToPoints = (
    achievement: Achievement & { type: 'ferryData' },
  ): Point[] => {
    const aFerry = ferries.get(achievement.endpointA);
    const bFerry = ferries.get(achievement.endpointB);
    if (aFerry == null || bFerry == null) {
      return [];
    }

    const aDlcGuard = getDlcGuard(aFerry);
    const bDlcGuard = getDlcGuard(bFerry);
    const dlcGuard = calcDlcGuard(aDlcGuard, bDlcGuard);
    return [
      { coordinates: aFerry, dlcGuard },
      { coordinates: bFerry, dlcGuard },
    ];
  };
  const deliveryPointAchievementToPoints = (
    achievement: Achievement & { type: 'eachDeliveryPoint' },
  ): Point[] => {
    const cityTokens = new Set<string>(
      [...achievement.sources, ...achievement.targets].flatMap(s =>
        s.split('.').slice(2, 4),
      ),
    );
    const unknownCities = [...cityTokens].filter(t => !cities.has(t));
    if (unknownCities.length > 0) {
      logger.error('unknown cities encountered', unknownCities);
      return [];
    }

    const cs = [...cityTokens].map(t => assertExists(cities.get(t)));
    const countryTokens = new Set<string>(cs.map(c => c.countryToken));
    const atsDlc = [...countryTokens].map(t => {
      const country = assertExists(countries.get(t));
      const guard = assertExists(
        AtsCountryIdToDlcGuard[country.id as AtsCountryId],
      );
      const set = AtsDlcGuards[guard];
      assert(set.size === 1);
      return [...set][0];
    });
    let dlcGuard: number | undefined;
    for (const [key, set] of Object.entries(AtsDlcGuards)) {
      if (atsDlc.every(c => set.has(c))) {
        dlcGuard = Number(key);
        break;
      }
    }
    if (dlcGuard == null) {
      logger.warn('could not calculate dlcGuard');
      dlcGuard = 0;
    }

    return cs.map(city => {
      const cityArea = assertExists(city.areas.find(a => !a.hidden));
      return {
        coordinates: {
          x: city.x + cityArea.width / 2,
          y: city.y + cityArea.height / 2,
        },
        dlcGuard,
      };
    });
  };
  const routesToPoints = (): Point[] => {
    const points: Point[] = [];
    for (const t of trajectories.values()) {
      for (const c of t.checkpoints) {
        const r = assertExists(routes.get(c.route));
        const cs = [r.fromCity, r.toCity].map(t => assertExists(cities.get(t)));
        const countryTokens = new Set<string>(cs.map(c => c.countryToken));
        const atsDlc = [...countryTokens].map(t => {
          const country = assertExists(countries.get(t));
          const guard = assertExists(
            AtsCountryIdToDlcGuard[country.id as AtsCountryId],
          );
          const set = AtsDlcGuards[guard];
          if (set.size === 0) {
            return 0;
          }
          assert(
            set.size === 1,
            `expected singleton set for ${country.id}, got ${[...set].join(',')}`,
          );
          return [...set][0];
        });
        let dlcGuard: number | undefined;
        for (const [key, set] of Object.entries(AtsDlcGuards)) {
          if (atsDlc.every(c => set.has(c))) {
            dlcGuard = Number(key);
            break;
          }
        }
        if (dlcGuard == null) {
          logger.warn('could not calculate dlcGuard');
          dlcGuard = 0;
        }

        points.push({
          coordinates: t,
          dlcGuard,
        });
      }
    }
    return points;
  };

  const exists = <T>(x: T): x is NonNullable<T> => x != null;
  const features: AchievementFeature[] = [...achievements.entries()].flatMap(
    ([name, a]) => {
      const points: Point[] = [];
      switch (a.type) {
        case 'visitCityData':
          points.push(
            ...a.cities.filter(t => cities.has(t)).map(cityTokenToPoint),
          );
          break;
        case 'delivery':
          points.push(
            ...a.companies.flatMap(a => {
              switch (a.locationType) {
                case 'city':
                  if (!cities.has(a.locationType)) {
                    return [];
                  }
                  return assertExists(
                    cityAndCompanyTokensToPoint(a.locationToken, a.company),
                  );
                case 'country': {
                  const country = countries.get(a.locationToken);
                  if (!country) {
                    logger.warn('ignoring country', a.locationToken);
                    return [];
                  }

                  const citiesInCountry = [...cities.values()].filter(
                    c => c.countryToken === country.token,
                  );
                  return citiesInCountry
                    .map(c => cityAndCompanyTokensToPoint(c.token, a.company))
                    .filter(c => c != null);
                }
                default:
                  throw new UnreachableError(a.locationType);
              }
            }),
          );
          break;
        case 'eachCompanyData':
        case 'deliverCargoData':
          points.push(
            ...a.companies
              .map(c => cityAndCompanyTokensToPoint(c.city, c.company))
              .filter(exists),
          );
          break;
        case 'triggerData': {
          const triggerItems = triggerAchievementToPoints(a);
          points.push(...triggerItems);
          if (triggerItems.length < a.count) {
            logger.warn(
              name,
              'wants',
              a.count,
              'but received',
              triggerItems.length,
            );
          }
          break;
        }
        case 'ferryData':
          points.push(...ferryAchievementToPoints(a));
          break;
        case 'eachDeliveryPoint': {
          const deliverPoints = deliveryPointAchievementToPoints(a);
          if (deliverPoints.length === 0) {
            logger.warn('ignoring', name);
          }
          points.push(...deliverPoints);
          break;
        }
        case 'oversizeRoutesData':
          if (routes.size === 0) {
            logger.warn('ignoring empty special transports routes map');
            break;
          }
          points.push(...routesToPoints());
          break;
        default:
          throw new UnreachableError(a);
      }

      // ALL THE HACKS
      const uniqPoints = [
        ...new Set<string>(points.map(p => JSON.stringify(p))),
      ].map(s => JSON.parse(s) as Point);

      return uniqPoints.map(({ coordinates: { x, y }, dlcGuard }) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [x, y] },
        properties: { name, dlcGuard },
      }));
    },
  );

  const normalizeCoordinates = createNormalizeFeature(map, 4);
  return {
    type: 'FeatureCollection',
    features: features.map(normalizeCoordinates),
  } as const;
}

function calcDlcGuard(startDlc: number, endDlc: number) {
  if (startDlc !== endDlc) {
    logger.warn('dlcGuard mismatch', startDlc, endDlc);
  }
  return startDlc;
}
