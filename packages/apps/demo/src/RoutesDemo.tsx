import { Autocomplete, List, ListDivider, Typography } from '@mui/joy';
import type { AutocompleteRenderGroupParams } from '@mui/joy/Autocomplete/AutocompleteProps';
import { assertExists } from '@truckermudgeon/base/assert';
import { getExtent } from '@truckermudgeon/base/geom';
import { putIfAbsent } from '@truckermudgeon/base/map';
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
  GameMapStyle,
  SceneryTownSource,
  defaultMapStyle,
} from '@truckermudgeon/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useState } from 'react';
import type { GeoJSONSource } from 'react-map-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import MapGl, {
  AttributionControl,
  FullscreenControl,
  Layer,
  NavigationControl,
  Source,
  useMap,
} from 'react-map-gl/maplibre';

const RoutesDemo = () => {
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
      // start off in vegas
      initialViewState={{
        longitude: -115,
        latitude: 36,
        zoom: 9,
      }}
    >
      <BaseMapStyle />
      <GameMapStyle game={'ats'} />
      <SceneryTownSource enableAutoHide={true} />
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
      <AttributionControl
        compact={true}
        customAttribution="&copy; Trucker Mudgeon. scenery town data by <a href='https://github.com/nautofon/ats-towns'>nautofon</a>."
      />
      <RouteControl />
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
  city: string;
  // uid
  value: string;
}

interface GroupedCompanyOption {
  // city token
  label: string;
  options: CompanyOption[];
}

const RouteControl = () => {
  const { current: map } = useMap();

  const [demoData, setDemoData] = useState<DemoRoutesData | undefined>(
    undefined,
  );
  const [context, setContext] = useState<Context | undefined>(undefined);
  const [startCompaniesByCity, setStartCompaniesByCity] = useState<
    GroupedCompanyOption[]
  >([]);
  const [endCompaniesByCity, setEndCompaniesByCity] = useState<
    GroupedCompanyOption[]
  >([]);
  useEffect(() => {
    fetch('usa-graph-demo.json')
      .then(r => r.json() as Promise<DemoRoutesData>)
      .then(
        data => {
          const companiesByCityToken = new Map<string, CompanyOption[]>();
          for (const company of data.demoCompanies) {
            putIfAbsent(company.c, [], companiesByCityToken).push(
              toCompanyOption(company),
            );
          }
          setStartCompaniesByCity(
            toGroupedCompanyOptions(companiesByCityToken),
          );
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
        const companiesByCityToken = new Map<string, CompanyOption[]>();
        for (const company of demoData.demoCompanies) {
          if (destTokens.has(company.t)) {
            putIfAbsent(company.c, [], companiesByCityToken).push(
              toCompanyOption(company),
            );
          }
        }
        setEndCompaniesByCity(toGroupedCompanyOptions(companiesByCityToken));
      }

      if (map == null || context == null) {
        return;
      }
      if (end != null) {
        const routeSource = assertExists(
          map.getSource('route1') as GeoJSONSource | undefined,
        );
        routeSource.setData({
          type: 'FeatureCollection',
          features: [],
        } as GeoJSON.FeatureCollection);
        setEnd(undefined);
      }

      if (matchingCompany) {
        const matchingNode = assertExists(
          context.nodeLUT.get(matchingCompany.n),
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
      fetchRoute(assertExists(start), option.value, map, context);
    },
    [map, start, context],
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
        if (maybeLineStrings.some(s => s == null)) {
          // TODO clear route; show error
          return;
        }
        const lineStrings =
          maybeLineStrings as GeoJSON.Feature<GeoJSON.LineString>[];
        const routeSource = assertExists(
          map.getSource('route1') as GeoJSONSource | undefined,
        );
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

  const startOptions = startCompaniesByCity.reduce<CompanyOption[]>(
    (acc, group) => {
      acc.push(...group.options);
      return acc;
    },
    [],
  );
  const endOptions = endCompaniesByCity.reduce<CompanyOption[]>(
    (acc, group) => {
      acc.push(...group.options);
      return acc;
    },
    [],
  );

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

function toContext(data: DemoRoutesData): Context {
  const graph = new Map<string, Neighbors>();
  const nodeLUT = new Map<string, PartialNode>();
  for (const [id, dns] of data.demoGraph) {
    graph.set(id, {
      forward: (dns.f ?? []).map(toNeighbor),
      backward: (dns.b ?? []).map(toNeighbor),
    });
  }
  for (const [id, pos] of data.demoNodes) {
    nodeLUT.set(id, { x: pos[0], y: pos[1] });
  }

  return {
    graph,
    nodeLUT,
  };
}

function toNeighbor(demoNeighbor: DemoNeighbor): Neighbor {
  return {
    nodeId: demoNeighbor.n,
    distance: demoNeighbor.l,
    isOneLaneRoad: demoNeighbor.o,
    direction: demoNeighbor.d === 'f' ? 'forward' : 'backward',
  };
}

function toCompanyOption(demoCompany: DemoCompany): CompanyOption {
  return {
    label: demoCompany.t,
    city: demoCompany.c,
    value: demoCompany.n,
  };
}

function toGroupedCompanyOptions(
  companiesByCityToken: Map<string, CompanyOption[]>,
): GroupedCompanyOption[] {
  return [...companiesByCityToken.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cityToken, companies]) => ({
      label: cityToken,
      options: companies,
    }));
}

function fakeFind(
  startNodeUid: string,
  endNodeUid: string,
  mode: Mode,
  context: Context,
): Promise<GeoJSON.Feature | undefined> {
  return new Promise(resolve => {
    const route = findRoute(startNodeUid, endNodeUid, 'forward', mode, context);
    if (!route) {
      resolve(undefined);
      return;
    }

    resolve({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: route.route.map(neighbor => {
          const node = assertExists(context.nodeLUT.get(neighbor.nodeId));
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
