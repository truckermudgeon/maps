import { BranchType } from '@truckermudgeon/navigation/constants';
import type { AppClient } from './controllers/types';

const fakeLat = 36.282;
const fakeLon = -114.806;
const fakeRoute: [number, number][] = [
  [fakeLon, fakeLat],
  [fakeLon + 1, fakeLat + 1],
];
let mode: 'light' | 'dark' = 'light';

export const fakeAppClient: AppClient = {
  setActiveRoute: {
    mutate: () => Promise.resolve(undefined),
  },
  onRouteUpdate: {
    subscribe: (_, cb) => {
      let ticks = 0;
      setInterval(
        () =>
          ticks++ % 2 === 0
            ? cb.onData?.(undefined)
            : cb.onData?.({
                id: 'active',
                segments: [
                  {
                    key: 'key',
                    lonLats: fakeRoute,
                    distance: 0,
                    time: 0,
                    strategy: 'shortest',
                  },
                ],
              }),
        6_000,
      );
      return {
        unsubscribe: () => void 0,
      };
    },
  },
  onDirectionUpdate: {
    subscribe: (_, cb) => {
      const intervalId = setInterval(
        () =>
          cb.onData?.({
            direction:
              Math.random() > 0.5 ? BranchType.THROUGH : BranchType.LEFT,
            distanceMeters: Math.random() * 2000,
            laneHint: {
              lanes: Array.from(
                { length: Math.round(Math.random() * 4) },
                () => ({
                  branches: Array.from(
                    { length: Math.ceil(Math.random() * 3) },
                    () =>
                      Math.random() > 0.5
                        ? BranchType.THROUGH
                        : BranchType.LEFT,
                  ),
                  activeBranch:
                    Math.random() > 0.5 ? BranchType.LEFT : BranchType.THROUGH,
                }),
              ),
            },
          }),
        2_000,
      );
      return {
        unsubscribe: () => clearInterval(intervalId),
      };
    },
  },
  onThemeModeUpdate: {
    subscribe: (_, cb) => {
      const intervalId = setInterval(() => {
        cb.onData?.(mode);
        mode = mode === 'light' ? 'dark' : 'light';
      }, 5_000);
      return {
        unsubscribe: () => clearInterval(intervalId),
      };
    },
  },
  onTrailerUpdate: {
    subscribe: (_, cb) => {
      const intervalId = setInterval(
        () =>
          cb.onData?.(
            Math.random() < 0.5
              ? {
                  position: [fakeLon, fakeLat],
                  attached: false,
                }
              : undefined,
          ),
        1_000,
      );
      return {
        unsubscribe: () => clearInterval(intervalId),
      };
    },
  },
  onPositionUpdate: {
    subscribe: (_, cb) => {
      let intervalCount = 0;
      let speedTicks = 0;
      let speed = 0;
      //let bearing = -180;
      const intervalId = setInterval(() => {
        if (speedTicks++ % 10 === 0) {
          speed = Math.round(60 * (0.875 + Math.random() * 0.25));
        }
        cb.onData?.({
          bearing: 0,
          position: [++intervalCount * 0.0002 + fakeLon, fakeLat],
          scale: 0,
          speedLimit: 60,
          speedMph: speed,
        });
        //bearing -= 5;
        //if (bearing < -180) {
        //  bearing += 360;
        //}
      }, 500);
      return {
        unsubscribe: () => clearInterval(intervalId),
      };
    },
  },
  previewRoutes: {
    query: async () => {
      await delay(2000);
      return Array.from({ length: 2 }, (_, i) => ({
        id: `preview-${i}`,
        segments: [
          {
            key: `key-0-${i}`,
            lonLats: [
              fakeRoute.at(0)!,
              [fakeLon + Math.pow(0.3, i + 1), fakeLat + Math.pow(0.6, i + 1)],
            ],
            nodeUids: ['0', '1'],
            distance: 0,
            time: 0,
            strategy: 'shortest',
          },
          {
            key: `key-1-${i}`,
            lonLats: [
              [fakeLon + Math.pow(0.3, i + 1), fakeLat + Math.pow(0.6, i + 1)],
              fakeRoute.at(-1)!,
            ],
            nodeUids: ['1', '2'],
            distance: 0,
            time: 0,
            strategy: 'shortest',
          },
        ],
      }));
    },
  },
  search: {
    query: async () => {
      await delay(2000);
      return Array.from({ length: 3 }, (_, i) => ({
        nodeUid: i.toString(),
        lonLat: [fakeLon + i * 0.1, fakeLat + 0.1],
        distanceMeters: 0,
        bearing: 0,
        name: 'search result',
        logoUrl: '/icons/gas_ico.png',
        city: 'city',
        state: 'state',
        isCityStateApproximate: false,
        facilityUrls:
          i === 1
            ? [
                '/icons/gas_ico.png',
                '/icons/parking_ico.png',
                '/icons/service_ico.png',
              ]
            : [],
      }));
    },
  },
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
