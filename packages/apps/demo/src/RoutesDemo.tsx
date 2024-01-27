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
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as pmtiles from 'pmtiles';
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
import type { SingleValue } from 'react-select';
import Select from 'react-select';
import { BaseMapStyle } from './BaseMapStyle';
import {
  GameMapStyle,
  baseTextLayout,
  baseTextPaint,
  textVariableAnchor,
} from './GameMapStyle';
import { sceneryTownsUrl } from './SearchBar';

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

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
      mapStyle={{
        version: 8,
        // can't specify relative urls
        // https://github.com/maplibre/maplibre-gl-js/issues/182
        //sprite: 'http://localhost:5173/sprites',
        sprite: 'https://truckermudgeon.github.io/sprites',
        // free font glyphs, required when adding text-fields.
        // https://github.com/openmaptiles/fonts
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        // sources and layers are empty because they're declared as child
        // components below.
        sources: {},
        layers: [],
      }}
      // start off in vegas
      initialViewState={{
        longitude: -115,
        latitude: 36,
        zoom: 9,
      }}
    >
      <BaseMapStyle />
      <GameMapStyle game={'ats'} />
      <Source id={`scenery-towns`} type={'geojson'} data={sceneryTownsUrl}>
        <Layer
          id={`scenery-towns`}
          type={'symbol'}
          minzoom={7}
          layout={{
            ...baseTextLayout,
            'text-field': '{name}',
            'text-variable-anchor': textVariableAnchor,
            'text-size': 10.5,
          }}
          paint={baseTextPaint}
        />
      </Source>
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
    (option: SingleValue<CompanyOption>) => {
      option = assertExists(option);
      setStart(option.value);
      let matchingCompany: DemoCompany | undefined;
      if (demoData != null) {
        matchingCompany = assertExists(
          demoData.demoCompanies.find(dc => dc.n === option!.value),
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
    (option: SingleValue<CompanyOption>) => {
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
      <Select<CompanyOption, false, GroupedCompanyOption>
        options={startCompaniesByCity}
        onChange={onSelectStart}
      />
      <h2>End</h2>
      <Select<CompanyOption, false, GroupedCompanyOption>
        // Hack to clear selection when `start` changes.
        key={start}
        options={endCompaniesByCity}
        onChange={onSelectEnd}
        isDisabled={start == null}
      />
    </div>
  );
};

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
