import {
  Autocomplete,
  List,
  ListDivider,
  Typography,
  useColorScheme,
} from '@mui/joy';
import type { AutocompleteRenderGroupParams } from '@mui/joy/Autocomplete/AutocompleteProps';
import { assertExists } from '@truckermudgeon/base/assert';
import { getExtent } from '@truckermudgeon/base/geom';
import type { AtsDlcGuard } from '@truckermudgeon/map/constants';
import {
  AtsSelectableDlcs,
  toAtsDlcGuards,
  type AtsSelectableDlc,
} from '@truckermudgeon/map/constants';
import type { Context, Mode, PartialNode } from '@truckermudgeon/map/routing';
import { findRoute } from '@truckermudgeon/map/routing';
import type {
  DemoCompany,
  DemoNeighbor,
  DemoRoutesData,
  Neighbor,
  Neighbors,
} from '@truckermudgeon/map/types';
import {
  BaseMapStyle,
  ContoursStyle,
  GameMapStyle,
  SceneryTownSource,
  allIcons,
  defaultMapStyle,
} from '@truckermudgeon/ui';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useState } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import MapGl, {
  AttributionControl,
  FullscreenControl,
  Layer,
  NavigationControl,
  Source,
  useMap,
} from 'react-map-gl/maplibre';
import { Legend, createListProps } from './Legend';
import { ModeControl } from './ModeControl';
import { toStateCodes } from './state-codes';

const RoutesDemo = (props: { tileRootUrl: string }) => {
  const { tileRootUrl } = props;
  const { mode: _maybeMode, systemMode } = useColorScheme();
  const mode = _maybeMode === 'system' ? systemMode : _maybeMode;
  const [autoHide, setAutoHide] = useState(true);
  const [visibleIcons, setVisibleIcons] = useState(new Set(allIcons));
  const [visibleAtsDlcs, setVisibleAtsDlcs] = useState(
    new Set(AtsSelectableDlcs),
  );
  const visibleStates = toStateCodes(visibleAtsDlcs);

  const iconsListProps = createListProps(
    visibleIcons,
    setVisibleIcons,
    allIcons,
  );

  const atsDlcsListProps = createListProps(
    visibleAtsDlcs,
    setVisibleAtsDlcs,
    AtsSelectableDlcs,
  );

  const [showContours, setShowContours] = useState(false);

  return (
    <MapGl
      style={{ width: '100vw', height: '100vh' }} // ensure map fills page
      minZoom={4}
      maxZoom={15}
      maxBounds={[
        [-135, 21], // southwest corner (lon, lat)
        [-84, 54], // northeast corner (lon, lat)
      ]}
      mapStyle={defaultMapStyle}
      attributionControl={false}
      // start off in vegas
      initialViewState={{
        longitude: -115,
        latitude: 36,
        zoom: 9,
      }}
    >
      <BaseMapStyle tileRootUrl={tileRootUrl} mode={mode}>
        <ContoursStyle
          tileRootUrl={tileRootUrl}
          game={'ats'}
          showContours={showContours}
        />
      </BaseMapStyle>
      <GameMapStyle
        tileRootUrl={tileRootUrl}
        game={'ats'}
        mode={mode}
        enableIconAutoHide={autoHide}
        visibleIcons={visibleIcons}
        dlcs={visibleAtsDlcs}
      />
      <SceneryTownSource
        game={'ats'}
        mode={mode}
        enableAutoHide={autoHide}
        enabledStates={visibleStates}
      />
      <Source
        id={'route1'}
        type={'geojson'}
        data={
          {
            type: 'FeatureCollection',
            features: [],
          } as GeoJSON.FeatureCollection
        }
      >
        <Layer
          type={'line'}
          paint={{
            'line-color': [
              'match',
              ['get', 'mode'],
              'shortest',
              '#f00',
              'smallRoads',
              '#0f0',
              '#f0f',
            ],
            'line-width': 3,
            'line-opacity': 0.7,
          }}
        />
      </Source>
      <NavigationControl visualizePitch={true} />
      <FullscreenControl />
      <ModeControl />
      <AttributionControl
        compact={true}
        customAttribution="&copy; Trucker Mudgeon. scenery town data by <a href='https://github.com/nautofon/ats-towns'>nautofon</a>."
      />
      <RouteControl dlcs={visibleAtsDlcs} />
      <Legend
        icons={{
          ...iconsListProps,
          enableAutoHiding: autoHide,
          onAutoHidingToggle: setAutoHide,
        }}
        advanced={{
          showContours,
          onContoursToggle: setShowContours,
        }}
        atsDlcs={atsDlcsListProps}
      />
    </MapGl>
  );
};

export default RoutesDemo;

/*
ℹ ignoring gal_oil_gst sacramento
ℹ ignoring vor_oil_gst salina_ks
ℹ ignoring elv_el_pln salina_ks
ℹ ignoring vor_oil_gst tulsa
ℹ ignoring vor_oil_gst woodward
ℹ ignoring vor_oil_gst lufkin
ℹ ignoring gal_oil_gst evanston
 */

export interface CompanyOption {
  // company token
  label: string;
  // city token
  city: string;
  // base36 node uid
  value: string;
}

const RouteControl = (props: { dlcs: ReadonlySet<AtsSelectableDlc> }) => {
  const { current: map } = useMap();
  const enabledDlcGuards = toAtsDlcGuards(props.dlcs);
  const [demoData, setDemoData] = useState<DemoRoutesData | undefined>(
    undefined,
  );
  const [context, setContext] = useState<
    Omit<Context, 'enabledDlcGuards'> | undefined
  >(undefined);
  const [startCompanies, setStartCompanies] = useState<CompanyOption[]>([]);
  const [endCompanies, setEndCompanies] = useState<CompanyOption[]>([]);
  useEffect(() => {
    fetch('usa-graph-demo.json')
      .then(r => r.json() as Promise<DemoRoutesData>)
      .then(
        data => {
          setStartCompanies(data.demoCompanies.map(toCompanyOption));
          setContext(toContext(data));
          setDemoData(data);
        },
        () => console.error('could not load usa-graph-demo.json'),
      );
  }, []);

  const [start, setStart] = useState<string | undefined>(undefined);
  const [end, setEnd] = useState<string | undefined>(undefined);
  const onSelectStart = useCallback(
    (option: CompanyOption) => {
      option = assertExists(option);
      setStart(option.value);
      let matchingCompany: DemoCompany | undefined;
      if (demoData != null) {
        matchingCompany = assertExists(
          demoData.demoCompanies.find(dc => dc.n === option.value),
        );
        const matchingDef = assertExists(
          demoData.demoCompanyDefs.find(d => d.t === matchingCompany!.t),
        );
        const destTokens = new Set(matchingDef.d);
        setEndCompanies(
          demoData.demoCompanies
            .filter(c => destTokens.has(c.t))
            .map(toCompanyOption),
        );
      }

      if (map == null || context == null) {
        return;
      }
      if (end != null) {
        const routeSource = assertExists(
          map.getSource<GeoJSONSource>('route1'),
        );
        routeSource.setData({
          type: 'FeatureCollection',
          features: [],
        } as GeoJSON.FeatureCollection);
        setEnd(undefined);
      }

      if (matchingCompany) {
        const matchingNode = assertExists(
          context.nodeLUT.get(BigInt(parseInt(matchingCompany.n, 36))),
        );
        map.flyTo({
          curve: 1,
          zoom: 9,
          center: [matchingNode.x, matchingNode.y],
        });
      }
    },
    [map, end, context, demoData],
  );
  const onSelectEnd = useCallback(
    (option: CompanyOption) => {
      option = assertExists(option);
      setEnd(option.value);
      if (map == null || context == null) {
        return;
      }
      fetchRoute(assertExists(start), option.value, map, {
        ...context,
        enabledDlcGuards,
      });
    },
    [map, start, context, props.dlcs],
  );
  const fetchRoute = (
    startNodeUid: string,
    endNodeUid: string,
    map: MapRef,
    context: Context,
  ) => {
    Promise.all([
      fakeFind(startNodeUid, endNodeUid, 'shortest', context),
      fakeFind(startNodeUid, endNodeUid, 'smallRoads', context),
    ]).then(
      maybeLineStrings => {
        const routeSource = assertExists(
          map.getSource<GeoJSONSource>('route1'),
        );
        if (maybeLineStrings.some(s => s == null)) {
          alert('Cannot calculate a route 🙁');
          routeSource.setData({
            type: 'FeatureCollection',
            features: [],
          } as GeoJSON.FeatureCollection);
          return;
        }
        const lineStrings =
          maybeLineStrings as GeoJSON.Feature<GeoJSON.LineString>[];
        routeSource.setData({
          type: 'FeatureCollection',
          features: lineStrings,
        } as GeoJSON.FeatureCollection);
        map.fitBounds(
          getExtent(
            lineStrings.flatMap(
              ls => ls.geometry.coordinates as [number, number][],
            ),
          ),
          {
            padding: 150,
            curve: 1,
            duration: 2500,
          },
        );
      },
      err => {
        console.error('error finding route', err);
      },
    );
  };

  // base36 node UID to dlc guard
  const dlcGuards = new Map<string, number>();
  if (demoData) {
    for (const [, neighbors] of demoData.demoGraph) {
      for (const neighbor of [...(neighbors.b ?? []), ...(neighbors.f ?? [])]) {
        // Note: for some unknown reason, neighbors representing the same node
        // may have different dlcGuard values set. When such a neighbor is
        // encountered, prefer the non-zero dlcGuard value.
        const currGuard = dlcGuards.get(neighbor.n) ?? 0;
        dlcGuards.set(neighbor.n, currGuard || neighbor.g);
      }
    }
  }

  const filterByDlcs = (company: CompanyOption) => {
    if (context == null) {
      return true;
    }
    const dlcGuard = assertExists(dlcGuards.get(company.value));
    return enabledDlcGuards.has(dlcGuard as AtsDlcGuard);
  };
  const sortByCityThenLabel = (a: CompanyOption, b: CompanyOption) =>
    a.city !== b.city
      ? a.city.localeCompare(b.city)
      : a.label.localeCompare(b.label);

  const startOptions = startCompanies
    .filter(filterByDlcs)
    .sort(sortByCityThenLabel);
  const endOptions = endCompanies
    .filter(filterByDlcs)
    .sort(sortByCityThenLabel);

  return (
    <div
      style={{
        width: 300,
        margin: 20,
        display: 'grid',
        position: 'relative',
        gridTemplateColumns: '100px auto',
        alignItems: 'center',
      }}
    >
      <h2>Start</h2>
      <Autocomplete
        options={startOptions}
        onChange={(_, v) => v && onSelectStart(v)}
        groupBy={option => option.city}
        placeholder={'Select...'}
        blurOnSelect
        autoComplete
        disableClearable
        renderGroup={formatGroupLabel}
      />
      <h2>End</h2>
      <Autocomplete
        // Hack to clear selection when `start` changes.
        key={start}
        options={endOptions}
        onChange={(_, v) => v && onSelectEnd(v)}
        groupBy={option => option.city}
        placeholder={'Select...'}
        blurOnSelect
        autoComplete
        disableClearable
        disabled={start == null}
        renderGroup={formatGroupLabel}
      />
    </div>
  );
};

function formatGroupLabel(params: AutocompleteRenderGroupParams) {
  return (
    <>
      <Typography m={1} level={'body-xs'} textTransform={'uppercase'}>
        {params.group}
      </Typography>
      <List>{params.children}</List>
      <ListDivider />
    </>
  );
}

function toContext(data: DemoRoutesData): Omit<Context, 'enabledDlcGuards'> {
  const graph = new Map<bigint, Neighbors>();
  const nodeLUT = new Map<bigint, PartialNode>();
  for (const [id, dns] of data.demoGraph) {
    graph.set(BigInt(parseInt(id, 36)), {
      forward: (dns.f ?? []).map(toNeighbor),
      backward: (dns.b ?? []).map(toNeighbor),
    });
  }
  for (const [id, pos] of data.demoNodes) {
    nodeLUT.set(BigInt(parseInt(id, 36)), { x: pos[0], y: pos[1] });
  }

  return {
    graph,
    nodeLUT,
  };
}

function toNeighbor(demoNeighbor: DemoNeighbor): Neighbor {
  return {
    nodeUid: BigInt(parseInt(demoNeighbor.n, 36)),
    distance: demoNeighbor.l,
    isOneLaneRoad: demoNeighbor.o,
    direction: demoNeighbor.d === 'f' ? 'forward' : 'backward',
    dlcGuard: demoNeighbor.g,
  };
}

function toCompanyOption(demoCompany: DemoCompany): CompanyOption {
  return {
    label: demoCompany.t,
    city: demoCompany.c,
    value: demoCompany.n,
  };
}

function fakeFind(
  startNodeUid: string,
  endNodeUid: string,
  mode: Mode,
  context: Context,
): Promise<GeoJSON.Feature | undefined> {
  return new Promise(resolve => {
    const route = findRoute(
      BigInt(parseInt(startNodeUid, 36)),
      BigInt(parseInt(endNodeUid, 36)),
      'forward',
      mode,
      context,
    );
    if (!route.success) {
      resolve(undefined);
      return;
    }

    resolve({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: route.route.map(neighbor => {
          const node = assertExists(context.nodeLUT.get(neighbor.nodeUid));
          return [node.x, node.y];
        }),
      },
      properties: {
        distance: route.distance,
        mode: mode,
      },
    });
  });
}
