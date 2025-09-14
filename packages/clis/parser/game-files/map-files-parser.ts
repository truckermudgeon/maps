import { assert, assertExists } from '@truckermudgeon/base/assert';
import { distance } from '@truckermudgeon/base/geom';
import { putIfAbsent } from '@truckermudgeon/base/map';
import { Preconditions, UnreachableError } from '@truckermudgeon/base/precon';
import {
  ItemType,
  MapOverlayType,
  SpawnPointType,
} from '@truckermudgeon/map/constants';
import { toMapPosition } from '@truckermudgeon/map/prefabs';
import type {
  Building,
  City,
  CityArea,
  CompanyItem,
  Curve,
  Cutscene,
  DefData,
  Ferry,
  FerryConnection,
  FerryItem,
  Item,
  MapArea,
  MapData,
  MapOverlay,
  Model,
  Node,
  Poi,
  Prefab,
  Road,
  Sign,
  Terrain,
  TrajectoryItem,
  Trigger,
} from '@truckermudgeon/map/types';
import * as cliProgress from 'cli-progress';
import path from 'path';
import { logger } from '../logger';
import { CombinedEntries } from './combined-entries';
import { convertSiiToJson } from './convert-sii-to-json';
import { parseDds } from './dds-parser';
import { parseDefFiles } from './def-parser';
import type { Entries } from './scs-archive';
import { ScsArchive } from './scs-archive';
import { parseSector } from './sector-parser';
import {
  IconMatSchema,
  LocalizationSiiSchema,
  VersionSiiSchema,
} from './sii-schemas';

export function parseMapFiles(
  scsFilePaths: string[],
  { includeDlc, onlyDefs }: { includeDlc: boolean; onlyDefs: boolean },
):
  | {
      onlyDefs: false;
      map: string;
      mapData: MapData;
      icons: Map<string, Buffer>;
    }
  | {
      onlyDefs: true;
      map: string;
      defData: DefData;
    } {
  const requiredFiles = new Set([
    'base.scs',
    'base_map.scs',
    'base_share.scs',
    'core.scs',
    'def.scs',
    'locale.scs',
    'version.scs',
  ]);
  const archives = scsFilePaths
    .filter(p => {
      const fn = path.basename(p);
      return requiredFiles.has(fn) || (includeDlc && fn.startsWith('dlc'));
    })
    .map(p => {
      logger.log('adding', path.basename(p));
      return new ScsArchive(p);
    });
  const entries = new CombinedEntries(archives);
  try {
    const version = parseVersionSii(entries);
    const defData = parseDefFiles(entries, version.application);
    const l10n = assertExists(parseLocaleFiles(entries).get('en_us'));
    if (onlyDefs) {
      return {
        onlyDefs: true,
        map: version.application === 'ats' ? 'usa' : 'europe',
        defData: toDefData(defData, l10n),
      };
    }

    const icons = parseIconMatFiles(entries);
    const sectorData = parseSectorFiles(entries);
    return {
      onlyDefs: false,
      ...postProcess(defData, sectorData, icons, l10n),
    };
  } finally {
    archives.forEach(a => a.dispose());
  }
}

function parseVersionSii(entries: Entries) {
  const { application, version } = assertExists(
    Object.values(
      convertSiiToJson('version.sii', entries, VersionSiiSchema).fsPackSet,
    )[0],
  );
  logger.info('parsing', application, version);
  return { application, version };
}

function parseSectorFiles(entries: Entries) {
  const mapDir = Preconditions.checkExists(entries.directories.get('map'));
  const mbds = mapDir.files.filter(f => f.endsWith('.mbd'));
  if (mbds.length !== 1) {
    throw new Error();
  }
  const map = mbds[0].replace(/\.mbd$/, '');
  const sectorRoot = Preconditions.checkExists(
    entries.directories.get(`map/${map}`),
  );
  logger.start(`parsing ${map} sector files...`);
  const start = Date.now();

  const baseFiles = sectorRoot.files.filter(
    f => f.endsWith('.base') || f.endsWith('.aux'),
  );
  const bar = new cliProgress.SingleBar(
    {
      format: `[{bar}] | {filename} | {value} of {total}`,
      stopOnComplete: true,
      clearOnComplete: true,
    },
    cliProgress.Presets.rect,
  );
  bar.start(baseFiles.length, 0);

  const sectors = new Map<string, { items: Item[]; nodes: Node[] }>();
  const sectorRegex = /^sec([+-]\d{4})([+-]\d{4})$/;
  const seenNodeUids = new Set<bigint>();
  for (const f of baseFiles) {
    const sectorKey = f.replace(/\.(base|aux)$/, '');
    if (!sectorRegex.test(sectorKey)) {
      throw new Error(`unexpected sector key "${sectorKey}"`);
    }
    const [, sectorX, sectorY] = Array.from(
      assertExists(sectorRegex.exec(sectorKey)),
      parseFloat,
    );
    if (isNaN(sectorX) || isNaN(sectorY)) {
      throw new Error(`couldn't parse ${sectorX} or ${sectorY}`);
    }
    const sector = putIfAbsent(sectorKey, { items: [], nodes: [] }, sectors);
    const baseFile = assertExists(entries.files.get(`map/${map}/${f}`));
    const parsedSector = parseSector(baseFile.read(), seenNodeUids);
    sector.items = sector.items.concat(parsedSector.items);
    for (const node of parsedSector.nodes) {
      if (seenNodeUids.has(node.uid)) {
        continue;
      }
      seenNodeUids.add(node.uid);
      sector.nodes.push(node);
    }
    bar.increment({ filename: f });
  }
  logger.success(
    'parsed',
    baseFiles.length,
    'sector files in',
    (Date.now() - start) / 1000,
    'seconds',
  );

  return {
    map,
    sectors,
  };
}

function parseLocaleFiles(entries: Entries): Map<string, Map<string, string>> {
  logger.log('parsing locale files...');
  const l10nStrings = new Map<string, Map<string, string>>();

  let numKeys = 0;
  const locale = Preconditions.checkExists(entries.directories.get('locale'));
  for (const subdir of locale.subdirectories) {
    const localeSubdir = Preconditions.checkExists(
      entries.directories.get(`locale/${subdir}`),
    );
    const localeMap = putIfAbsent(
      subdir,
      new Map<string, string>(),
      l10nStrings,
    );
    for (const f of localeSubdir.files) {
      if (
        f !== 'local.sii' &&
        f !== 'local.override.sii' &&
        f !== 'localization.sui' &&
        f !== 'photoalbum.sui'
      ) {
        continue;
      }
      const json = convertSiiToJson(
        `locale/${subdir}/${f}`,
        entries,
        LocalizationSiiSchema,
      );
      const l10n = json.localizationDb['.localization'];
      if (Object.keys(l10n).length === 0) {
        continue;
      }
      const { key, val } = l10n;
      assert(key.length === val.length);
      for (let i = 0; i < key.length; i++) {
        localeMap.set(key[i], val[i]);
      }
    }
    // assumes all locales have the same number of entries.
    numKeys = localeMap.size;
  }

  logger.info(l10nStrings.size, 'locales,', numKeys, 'strings each');
  return l10nStrings;
}

function parseIconMatFiles(entries: Entries) {
  logger.log('parsing icon .mat files...');

  const endsWithMat = /\.mat$/g;
  const tobjPaths = new Map<string, string>();
  const sdfAuxData = new Map<string, number[][]>();
  const readTobjPathsFromMatFiles = (
    dir: string,
    filenameFilter: (filename: string) => boolean = f => f.endsWith('.mat'),
    replaceAll: RegExp = endsWithMat,
  ) => {
    Preconditions.checkArgument(replaceAll.global);
    const dirEntry = Preconditions.checkExists(entries.directories.get(dir));
    for (const f of dirEntry.files) {
      if (!filenameFilter(f)) {
        continue;
      }
      const json = convertSiiToJson(`${dir}/${f}`, entries, IconMatSchema);
      if (Object.keys(json).length === 0) {
        continue;
      }
      const key = f.replaceAll(replaceAll, '');
      if (json.effect) {
        const rfx = assertExists(
          json.effect['ui.rfx'] ?? json.effect['ui.sdf.rfx'],
        );
        tobjPaths.set(key, `${dir}/${rfx.texture.texture.source}`);
        if (json.effect['ui.sdf.rfx']) {
          sdfAuxData.set(key, json.effect['ui.sdf.rfx'].aux);
        }
      } else if (json.material) {
        tobjPaths.set(key, `${dir}/${json.material.ui.texture}`);
      } else {
        logger.warn(`unknown format for ${dir}/${f}`);
      }
    }
  };

  readTobjPathsFromMatFiles(
    'material/ui/map/road',
    f => f.startsWith('road_') && f.endsWith('.mat'),
    /^road_|\.mat$/g,
  );
  readTobjPathsFromMatFiles('material/ui/company/small');

  // hardcoded set of icon names that live in material/ui/map/
  const otherMatFiles = new Set(
    [
      'viewpoint', // for cutscenes (from ItemType.Cutscene)
      'photo_sight_captured', // for landmarks (from ItemType.MapOverlay, type Landmark)
      // facilities
      'parking_ico', // from ItemType.MapOverlay, type Parking; ItemType.Trigger; PrefabDescription TriggerPoints
      // from PrefabDescription SpawnPoints
      'gas_ico',
      'service_ico',
      'weigh_station_ico',
      'dealer_ico',
      'garage_large_ico',
      'recruitment_ico',
      // not rendered on map, but useful for Map Legend UI
      'city_names_ico',
      'companies_ico',
      'road_numbers_ico',
      // these 4 files can be combined to help trace state / country borders
      // 'map0',
      // 'map1',
      // 'map2',
      // 'map3',
    ].map(n => `${n}.mat`),
  );
  readTobjPathsFromMatFiles('material/ui/map', f => otherMatFiles.has(f));

  const pngs = new Map<string, Buffer>();
  for (const [key, tobjPath] of tobjPaths) {
    const tobj = entries.files.get(tobjPath);
    if (!tobj) {
      logger.warn('could not find', tobjPath);
      continue;
    }
    // A .tobj file in a HashFs v2 archive is actually a file with header-less
    // .dds pixel data. Assume that the concrete instance of the FileEntry for
    // the .tobj file is an ScsArchiveTobjFile, whose .read() returns a complete
    // header-ful .dds file.
    pngs.set(key, parseDds(tobj.read(), sdfAuxData.get(key)));
  }
  return pngs;
}

function postProcess(
  defData: ReturnType<typeof parseDefFiles>,
  { sectors, map }: ReturnType<typeof parseSectorFiles>,
  icons: ReturnType<typeof parseIconMatFiles>,
  l10n: Map<string, string>,
): { map: string; mapData: MapData; icons: Map<string, Buffer> } {
  logger.log('building node and item LUTs...');
  const nodesByUid = new Map<bigint, Node>();
  const itemsByUid = new Map<bigint, Item>();
  for (const s of sectors.values()) {
    for (const n of s.nodes) {
      nodesByUid.set(n.uid, n);
    }
    for (const i of s.items) {
      itemsByUid.set(i.uid, i);
    }
  }
  logger.success('built', nodesByUid.size, 'node LUT entries');
  logger.success('built', itemsByUid.size, 'item LUT entries');

  const referencedNodeUids = new Set<bigint>();
  const referencedPrefabTokens = new Set<string>();
  const referencedSignTokens = new Set<string>();
  const elevationNodeUids = new Set<bigint>();
  const cityAreas = new Map<string, CityArea[]>();
  const prefabs: Prefab[] = [];
  const models: Model[] = [];
  const prefabsByUid = new Map<bigint, Prefab>();
  const mapAreas: MapArea[] = [];
  const cutscenes: Cutscene[] = [];
  const triggers: Trigger[] = [];
  const signs: Sign[] = [];
  const ferryItems = new Map<string, FerryItem>();
  const poifulItems: (
    | Prefab
    | MapOverlay
    | CompanyItem
    | FerryItem
    | Cutscene
    | Trigger
  )[] = [];
  const trajectories: TrajectoryItem[] = [];

  logger.log("checking items' references...");
  const start = Date.now();
  for (const item of itemsByUid.values()) {
    switch (item.type) {
      case ItemType.City:
        putIfAbsent(item.token, [], cityAreas).push(item);
        break;
      case ItemType.Road:
        checkReference(
          item.roadLookToken,
          defData.roadLooks,
          'roadLookToken',
          item,
        );
        checkReference(item.startNodeUid, nodesByUid, 'startNodeUid', item);
        checkReference(item.endNodeUid, nodesByUid, 'endNodeUid', item);
        referencedNodeUids.add(item.startNodeUid);
        referencedNodeUids.add(item.endNodeUid);
        elevationNodeUids.add(item.startNodeUid);
        elevationNodeUids.add(item.endNodeUid);
        break;
      case ItemType.Prefab:
        checkReference(item.token, defData.prefabs, 'prefab token', item);
        checkReference(item.nodeUids, nodesByUid, 'nodeUids', item);
        referencedPrefabTokens.add(item.token);
        item.nodeUids.forEach(uid => {
          referencedNodeUids.add(uid);
          elevationNodeUids.add(uid);
        });
        prefabs.push(item);
        prefabsByUid.set(item.uid, item);
        poifulItems.push(item);
        break;
      case ItemType.MapArea:
        checkReference(item.nodeUids, nodesByUid, 'nodeUids', item);
        item.nodeUids.forEach(uid => {
          referencedNodeUids.add(uid);
          elevationNodeUids.add(uid);
        });
        mapAreas.push(item);
        break;
      case ItemType.MapOverlay:
        checkReference(item.nodeUid, nodesByUid, 'nodeUid', item);
        referencedNodeUids.add(item.nodeUid);
        poifulItems.push(item);
        break;
      case ItemType.Ferry:
        checkReference(item.nodeUid, nodesByUid, 'nodeUid', item);
        checkReference(item.token, defData.ferries, 'ferry token', item);
        if (defData.ferries.has(item.token)) {
          referencedNodeUids.add(item.nodeUid);
          ferryItems.set(item.token, item);
          poifulItems.push(item);
        }
        break;
      case ItemType.Company:
        checkReference(item.nodeUid, nodesByUid, 'nodeUid', item);
        checkReference(item.token, icons, 'company token', item);
        // disable this line when not processing every state; gets noisy otherwise.
        checkReference(item.cityToken, defData.cities, 'city token', item);
        referencedNodeUids.add(item.nodeUid);
        poifulItems.push(item);
        break;
      case ItemType.Cutscene:
        checkReference(item.nodeUid, nodesByUid, 'nodeUid', item);
        referencedNodeUids.add(item.nodeUid);
        poifulItems.push(item);
        cutscenes.push(item);
        break;
      case ItemType.Trigger:
        checkReference(item.nodeUids, nodesByUid, 'nodeUids', item);
        item.nodeUids.forEach(uid => referencedNodeUids.add(uid));
        poifulItems.push(item);
        triggers.push(item);
        break;
      case ItemType.Sign:
        checkReference(item.nodeUid, nodesByUid, 'nodeUid', item);
        checkReference(item.token, defData.signs, 'sign token', item);
        referencedSignTokens.add(item.token);
        referencedNodeUids.add(item.nodeUid);
        signs.push(item);
        break;
      case ItemType.Model:
        // sector parsing returns _all_ models, but
        // def parsing only cares about the ones it thinks are buildings.
        if (!defData.models.has(item.token)) {
          if (defData.vegetation.has(item.token)) {
            elevationNodeUids.add(item.nodeUid);
          }
          break;
        }
        checkReference(item.nodeUid, nodesByUid, 'startNodeUid', item);
        referencedNodeUids.add(item.nodeUid);
        models.push(item);
        break;
      case ItemType.Terrain:
      case ItemType.Building:
      case ItemType.Curve:
        // N.B.: Terrains, Buildings, and Curves are only used for their
        // elevations and aren't returned in their parsed forms.
        elevationNodeUids.add(item.startNodeUid);
        elevationNodeUids.add(item.endNodeUid);
        break;
      case ItemType.TrajectoryItem:
        checkReference(item.nodeUids, nodesByUid, 'nodeUids', item);
        item.nodeUids.forEach(uid => referencedNodeUids.add(uid));
        trajectories.push(item);
        break;
      default:
        throw new UnreachableError(item);
    }
  }
  logger.success(
    'checked',
    itemsByUid.size,
    'items in',
    (Date.now() - start) / 1000,
    'seconds',
  );

  logger.log('scanning', poifulItems.length, 'items for points of interest...');
  const pois: Poi[] = [];
  const companies: CompanyItem[] = [];
  const noPoiCompanies: {
    token: string;
    itemUid: bigint;
    nodeUid: bigint;
  }[] = [];
  const fallbackPoiCompanies: {
    token: string;
    itemUid: bigint;
    nodeUid: bigint;
  }[] = [];
  for (const item of poifulItems) {
    switch (item.type) {
      case ItemType.Prefab: {
        const prefabDescription = assertExists(defData.prefabs.get(item.token));
        const prefabMeta = {
          prefabUid: item.uid,
          prefabPath: prefabDescription.path,
        };
        for (const sp of prefabDescription.spawnPoints) {
          const [x, y] = toMapPosition(
            [sp.x, sp.y],
            item,
            prefabDescription,
            nodesByUid,
          );
          const pos = {
            x,
            y,
          };
          switch (sp.type) {
            case SpawnPointType.GasPos:
              pois.push({
                ...prefabMeta,
                ...pos,
                type: 'facility',
                icon: 'gas_ico',
              });
              break;
            case SpawnPointType.ServicePos:
              pois.push({
                ...prefabMeta,
                ...pos,
                type: 'facility',
                icon: 'service_ico',
              });
              break;
            case SpawnPointType.WeightStationPos:
              pois.push({
                ...prefabMeta,
                ...pos,
                type: 'facility',
                icon: 'weigh_station_ico',
              });
              break;
            case SpawnPointType.TruckDealerPos:
              pois.push({
                ...prefabMeta,
                ...pos,
                type: 'facility',
                icon: 'dealer_ico',
              });
              break;
            case SpawnPointType.BuyPos:
              pois.push({
                ...prefabMeta,
                ...pos,
                type: 'facility',
                icon: 'garage_large_ico',
              });
              break;
            case SpawnPointType.RecruitmentPos:
              pois.push({
                ...prefabMeta,
                ...pos,
                type: 'facility',
                icon: 'recruitment_ico',
              });
              break;
            default:
              // TODO exhaustive switch, warn on unknown type.
              break;
          }
        }
        for (const tp of prefabDescription.triggerPoints) {
          const [x, y] = toMapPosition(
            [tp.x, tp.y],
            item,
            prefabDescription,
            nodesByUid,
          );
          if (tp.action === 'hud_parking') {
            pois.push({
              ...prefabMeta,
              type: 'facility',
              dlcGuard: item.dlcGuard,
              itemNodeUids: item.nodeUids,
              fromItemType: 'prefab',
              x,
              y,
              icon: 'parking_ico',
            });
          }
        }
        break;
      }
      case ItemType.MapOverlay: {
        const { x, y } = item;
        const pos = { x, y };
        switch (item.overlayType) {
          case MapOverlayType.Road:
            if (item.token === '') {
              // ignore
            } else if (!icons.has(item.token)) {
              logger.warn(
                `unknown road overlay token "${item.token}". skipping.`,
              );
            } else {
              // TODO look into ets2 road overlays with token 'weigh_ico'.
              // can they be considered facilities? do they have linked prefabs?
              pois.push({
                ...pos,
                type: 'road',
                dlcGuard: item.dlcGuard,
                nodeUid: item.nodeUid,
                icon: item.token,
              });
            }
            break;
          case MapOverlayType.Parking:
            pois.push({
              ...pos,
              type: 'facility',
              dlcGuard: item.dlcGuard,
              itemNodeUids: [item.nodeUid],
              icon: 'parking_ico',
              fromItemType: 'mapOverlay',
            });
            break;
          case MapOverlayType.Landmark: {
            const label =
              // Note: tried to treat this similar to viewpoints by searching
              // for entries in def files and matching item.uids, but item.uids
              // didn't match what was in the def files. Guessing landmark
              // object uids correspond to model uids, and not map overlay uids.
              l10n.get(`landmark_${item.token}`);
            if (label == null) {
              logger.warn(
                'missing landmark info for item',
                item.uid.toString(16),
              );
            }
            pois.push({
              ...pos,
              type: 'landmark',
              dlcGuard: item.dlcGuard,
              nodeUid: item.nodeUid,
              icon: 'photo_sight_captured',
              label: label ?? '',
            });
            break;
          }
        }
        break;
      }
      case ItemType.Company: {
        const prefabItem = prefabsByUid.get(item.prefabUid);
        if (!prefabItem) {
          logger.warn(
            'unknown prefab uid',
            item.prefabUid,
            'for company',
            item.token,
            `0x${item.uid.toString(16)}`,
          );
          break;
        }
        if (!icons.has(item.token)) {
          noPoiCompanies.push({
            token: item.token,
            itemUid: item.uid,
            nodeUid: item.nodeUid,
          });
          break;
        }

        const prefabDescription = assertExists(
          defData.prefabs.get(prefabItem.token),
        );
        const companySpawnPos = prefabDescription.spawnPoints.find(
          p => p.type === SpawnPointType.CompanyPos,
        );
        let x: number;
        let y: number;
        if (companySpawnPos) {
          [x, y] = toMapPosition(
            [companySpawnPos.x, companySpawnPos.y],
            prefabItem,
            prefabDescription,
            nodesByUid,
          );
        } else {
          fallbackPoiCompanies.push({
            token: item.token,
            itemUid: item.uid,
            nodeUid: item.nodeUid,
          });
          ({ x, y } = assertExists(nodesByUid.get(item.nodeUid)));
        }
        const companyName = defData.companies.get(item.token)?.name;
        if (companyName == null) {
          logger.warn('unknown company name for token', item.token);
        }
        const pos = { x, y };
        pois.push({
          ...pos,
          type: 'company',
          icon: item.token,
          label: companyName ?? item.token,
          cityToken: item.cityToken,
        });
        companies.push({
          ...item,
          x,
          y,
        });
        break;
      }
      case ItemType.Ferry: {
        const { x, y } = assertExists(nodesByUid.get(item.nodeUid));
        const pos = { x, y };
        const ferry = assertExists(defData.ferries.get(item.token));
        const label = ferry.nameLocalized
          ? assertExists(l10n.get(ferry.nameLocalized.replaceAll('@', '')))
          : ferry.name;
        pois.push({
          ...pos,
          type: item.train ? 'train' : 'ferry',
          icon: item.train ? 'train_ico' : 'port_overlay',
          label,
        });
        break;
      }
      case ItemType.Cutscene: {
        // a less magical check might be to read actions.stringParams,
        // and check that items 0 and 1 are "create" and "viewpoint".
        if ((item.flags & 0x00_00_00_ff) !== 0) {
          break;
        }
        const labelToken = defData.viewpoints.get(item.uid);
        const label = l10n.get(labelToken ?? '');
        if (label == null) {
          logger.warn('missing viewpoint info for item', item.uid.toString(16));
        }
        const { x, y } = item;
        const pos = { x, y };
        pois.push({
          ...pos,
          type: 'viewpoint',
          icon: 'viewpoint',
          label: label ?? '',
        });
        break;
      }
      case ItemType.Trigger: {
        const { x, y } = item;
        const pos = { x, y };
        if (item.actions.find(([key]) => key === 'hud_parking')) {
          pois.push({
            ...pos,
            type: 'facility',
            dlcGuard: item.dlcGuard,
            itemNodeUids: item.nodeUids,
            icon: 'parking_ico',
            fromItemType: 'trigger',
          });
        }
        break;
      }
      default:
        throw new UnreachableError(item);
    }
  }

  if (noPoiCompanies.length) {
    logger.warn(
      noPoiCompanies.length,
      'companies with unknown tokens skipped\n',
      noPoiCompanies.sort((a, b) => a.token.localeCompare(b.token)),
    );
  }
  if (fallbackPoiCompanies.length) {
    logger.warn(
      fallbackPoiCompanies.length,
      'companies with no company spawn points (used node position as fallback)\n',
      fallbackPoiCompanies.sort((a, b) => a.token.localeCompare(b.token)),
    );
  }

  // Augment partial city info from defs with position info from sectors
  const cities = new Map<string, City>();
  for (const [token, partialCity] of defData.cities) {
    const areas = cityAreas.get(token);
    if (areas == null) {
      logger.warn(token, 'has no matching CityArea items. ignoring.');
      continue;
    }
    const nonHidden = areas.find(a => !a.hidden);
    if (!nonHidden) {
      logger.warn(token, 'has no "location" CityArea item. ignoring.');
      continue;
    }
    cities.set(token, {
      ...partialCity,
      x: nonHidden.x,
      y: nonHidden.y,
      areas,
    });
  }

  const withLocalizedName = createWithLocalizedName(l10n);

  // Augment partial ferry info from defs with start/end position info
  const ferries: Ferry[] = [];
  for (const [token, partialFerry] of defData.ferries) {
    const { nodeUid, train } = assertExists(ferryItems.get(token));
    const { x, y } = assertExists(nodesByUid.get(nodeUid));

    const connections: FerryConnection[] = partialFerry.connections
      .filter(c => ferryItems.has(c.token))
      .map(partialConnection => {
        const { nodeUid } = assertExists(
          ferryItems.get(partialConnection.token),
        );
        const { x, y } = assertExists(nodesByUid.get(nodeUid));
        const { name, nameLocalized } = withLocalizedName(
          assertExists(defData.ferries.get(partialConnection.token)),
        );
        return {
          ...partialConnection,
          name,
          nameLocalized,
          nodeUid,
          x,
          y,
        };
      });
    ferries.push(
      withLocalizedName({
        ...partialFerry,
        train,
        connections,
        nodeUid,
        x,
        y,
      }),
    );
  }

  // Flag roads as possibly having terrain splitting them.
  // For performance, do this per-sector.
  // TODO use quadtree to speed this up.
  const roads: Road[] = [];
  const threshold = 2;
  let splitCount = 0;
  logger.start(
    'scanning sectors for roads possibly split by terrains or buildings',
  );
  const bar = new cliProgress.SingleBar(
    {
      format: `[{bar}] | {key} | {value} of {total}`,
      stopOnComplete: true,
      clearOnComplete: true,
    },
    cliProgress.Presets.rect,
  );
  bar.start(sectors.size, 0);
  const dividers: (Building | Curve)[] = [];
  for (const [key, { items }] of sectors.entries()) {
    const sectorRoads: Road[] = [];
    const sectorDividers: (Terrain | Building | Curve)[] = [];
    for (const i of items) {
      if (i.type === ItemType.Road) {
        sectorRoads.push(i);
      } else if (i.type === ItemType.Terrain) {
        sectorDividers.push(i);
      } else if (i.type === ItemType.Building) {
        // HACK hardcoded checks for schemes that are known to be used as "center kerbs"
        if (i.scheme === 'scheme20') {
          sectorDividers.push(i);
        }
      } else if (i.type === ItemType.Curve) {
        // HACK hardcoded checks for models that are known to be used as "center kerbs".
        // TODO parse def file, check model_desc has a path that starts with 'model/road_island/'
        if (i.model === '0i03a' || i.model === '0i03b') {
          sectorDividers.push(i);
        }
      }
    }

    dividers.push(...sectorDividers.filter(d => d.type !== ItemType.Terrain));
    for (const d of dividers) {
      referencedNodeUids.add(d.startNodeUid);
      referencedNodeUids.add(d.endNodeUid);
    }

    for (const r of sectorRoads) {
      const rStart = assertExists(nodesByUid.get(r.startNodeUid));
      const rEnd = assertExists(nodesByUid.get(r.endNodeUid));
      const splitsRoad = (t: Terrain | Building | Curve) => {
        const tStart = assertExists(nodesByUid.get(t.startNodeUid));
        const tEnd = assertExists(nodesByUid.get(t.endNodeUid));
        return (
          (distance(rStart, tStart) < threshold &&
            distance(rEnd, tEnd) < threshold) ||
          (distance(rStart, tEnd) < threshold &&
            distance(rEnd, tStart) < threshold)
        );
      };
      if (sectorDividers.some(splitsRoad)) {
        roads.push({
          ...r,
          maybeDivided: true,
        });
        splitCount++;
      } else {
        roads.push(r);
      }
    }
    bar.increment({ key });
  }
  logger.success(
    splitCount,
    'roads possibly split by terrains, buildings, or curves',
  );

  // Augment mileage targets from defs with position info from sectors.
  for (const [token, target] of defData.mileageTargets) {
    if ((target.x && target.y) || !target.nodeUid) {
      continue;
    }
    const { nodeUid, ...targetWithoutNodeUid } = target;
    const node = nodesByUid.get(nodeUid);
    if (node) {
      defData.mileageTargets.set(token, {
        ...targetWithoutNodeUid,
        x: Math.round(node.x * 100) / 100, // easting
        y: Math.round(node.y * 100) / 100, // southing
      });
      logger.trace('node', nodeUid, 'found for mileage target', token);
    } else {
      logger.debug('node', nodeUid, 'not found for mileage target', token);
    }
  }

  logger.info(elevationNodeUids.size, 'elevation nodes');
  const referencedNodes: Node[] = [];
  for (const uid of referencedNodeUids) {
    referencedNodes.push(assertExists(nodesByUid.get(uid)));
  }
  const elevationNodes: Node[] = [];
  for (const uid of elevationNodeUids) {
    elevationNodes.push(assertExists(nodesByUid.get(uid)));
  }

  return {
    map,
    mapData: {
      nodes: referencedNodes,
      elevation: elevationNodes.map(
        ({ x, y, z }) =>
          [x, y, z].map(i => Math.round(i)) as [number, number, number],
      ),
      roads,
      ferries,
      prefabs,
      companies,
      models,
      mapAreas,
      pois,
      dividers,
      triggers,
      signs,
      trajectories,
      cutscenes,
      countries: valuesWithTokens(defData.countries).map(withLocalizedName),
      cities: valuesWithTokens(cities).map(withLocalizedName),
      companyDefs: valuesWithTokens(defData.companies),
      roadLooks: valuesWithTokens(defData.roadLooks),
      prefabDescriptions: valuesWithTokens(defData.prefabs).filter(prefab =>
        referencedPrefabTokens.has(prefab.token),
      ),
      modelDescriptions: valuesWithTokens(defData.models),
      signDescriptions: valuesWithTokens(defData.signs).filter(sign =>
        referencedSignTokens.has(sign.token),
      ),
      achievements: valuesWithTokens(defData.achievements),
      routes: valuesWithTokens(defData.routes),
      mileageTargets: valuesWithTokens(defData.mileageTargets),
    },
    icons,
  };
}

function toDefData(
  defData: ReturnType<typeof parseDefFiles>,
  l10n: Map<string, string>,
) {
  const withLocalizedName = createWithLocalizedName(l10n);
  return {
    countries: valuesWithTokens(defData.countries).map(withLocalizedName),
    companyDefs: valuesWithTokens(defData.companies),
    roadLooks: valuesWithTokens(defData.roadLooks),
    prefabDescriptions: valuesWithTokens(defData.prefabs),
    modelDescriptions: valuesWithTokens(defData.models),
    signDescriptions: valuesWithTokens(defData.signs),
    achievements: valuesWithTokens(defData.achievements),
    routes: valuesWithTokens(defData.routes),
    mileageTargets: valuesWithTokens(defData.mileageTargets),
  };
}

function createWithLocalizedName(l10n: Map<string, string>) {
  return <T extends { name: string; nameLocalized: string | undefined }>(
    o: T,
  ) => ({
    ...o,
    nameLocalized: undefined,
    name: o.nameLocalized
      ? assertExists(l10n.get(o.nameLocalized.replaceAll('@', '')))
      : o.name,
  });
}

function valuesWithTokens<V>(map: Map<string, V>): (V & { token: string })[] {
  return [...map.entries()].map(([token, v]) => ({ token, ...v }));
}

function checkReference<T>(
  ref: T | readonly T[],
  store: { has(ref: T): boolean },
  fieldName: string,
  item: Item,
) {
  let refs: readonly T[];
  if (Array.isArray(ref)) {
    refs = ref;
  } else {
    // casting `as T` because
    // https://github.com/microsoft/TypeScript/issues/17002
    refs = [ref as T];
  }

  for (const ref of refs) {
    if (!store.has(ref)) {
      logger.warn(
        `unknown ${fieldName}`,
        ref,
        `for item`,
        `0x${item.uid.toString(16)}.`,
      );
    }
  }
}
