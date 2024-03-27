import {
  Autocomplete,
  createFilterOptions,
  List,
  ListDivider,
  Typography,
} from '@mui/joy';
import type { AutocompleteRenderGroupParams } from '@mui/joy/Autocomplete/AutocompleteProps';
import { getExtent, toSplinePoints } from '@truckermudgeon/base/geom';
import { toRoadStringsAndPolygons } from '@truckermudgeon/map/prefabs';
import type { PrefabDescription as BasePrefab } from '@truckermudgeon/map/types';
import { useEffect, useState } from 'react';

type PrefabDescription = BasePrefab & { path: string };

const mapColors = {
  [0]: '#eaeced', // road
  [1]: '#e6cc9f', // light
  [2]: '#d8a54e', // dark
  [3]: '#b1ca9b', // green
};

interface PrefabOption {
  label: string;
  group: string;
  value: PrefabDescription;
}

interface GroupedPrefabOption {
  label: string;
  options: PrefabOption[];
}

const App = () => {
  const [open, setOpen] = useState(false);
  const [prefabs, setPrefabs] = useState<GroupedPrefabOption[]>([]);
  const [active, setActive] = useState<PrefabDescription | undefined>(
    undefined,
  );

  const onChange = (p: PrefabOption) => {
    setActive(p?.value);
  };

  const promiseOptions = async () => {
    const toGroups = (
      ps: PrefabDescription[],
    ): [GroupedPrefabOption, GroupedPrefabOption] => [
      {
        label: 'Roads',
        options: ps.filter(p => p.navCurves.length).map(toOption('Roads')),
      },
      {
        label: 'Non-roads',
        options: ps.filter(p => !p.navCurves.length).map(toOption('Non-roads')),
      },
    ];

    const toOption = (group: string) => (p: PrefabDescription) => ({
      group,
      label: p.path,
      value: p,
    });

    if (prefabs.length) {
      const ps1 = prefabs[0].options.map(o => o.value);
      const ps2 = prefabs[1].options.map(o => o.value);
      return toGroups([...ps1, ...ps2]);
    }

    const res = await fetch('/usa-prefabDescriptions.json');
    const json = ((await res.json()) as PrefabDescription[]).filter(p => {
      const roadPoints = p.mapPoints.filter(
        mp => mp.type === 'road' && mp.lanesRight && mp.lanesLeft,
      );
      const allRoads = p.mapPoints.every(p => p.type === 'road');
      const allAuto = p.mapPoints.every(
        p =>
          p.type === 'road' &&
          p.lanesLeft === 'auto' &&
          p.lanesRight === 'auto',
      );
      const someAuto = p.mapPoints.some(
        p =>
          p.type === 'road' &&
          p.lanesLeft === 'auto' &&
          p.lanesRight === 'auto',
      );
      return allRoads && roadPoints.length > 1 && p.nodes.length >= 2; // && p.nodes.length !== 2 && p.mapPoints.length !== 2
      //return (
      //  p.navCurves.length &&
      //  p.mapPoints.some(p => p.type === 'polygon' && p.roadOver)
      //);
    });

    const groups = toGroups(json);
    setPrefabs(groups);
    return groups;
  };

  const options = prefabs.reduce<PrefabOption[]>((acc, group) => {
    acc.push(...group.options);
    return acc;
  }, []);
  const loading = open && options.length === 0;
  useEffect(() => {
    let active = true;
    if (!loading) {
      return undefined;
    }

    void promiseOptions().then(groups => {
      if (active) {
        setPrefabs(groups);
      }
    });

    return () => {
      active = false;
    };
  }, [loading]);

  const filterOptions = createFilterOptions<PrefabOption>({
    stringify: option => option.label.replaceAll('_', ' '),
  });

  return (
    <>
      <Autocomplete
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        onChange={(_, v) => v && onChange(v)}
        placeholder={'Select...'}
        options={options}
        filterOptions={filterOptions}
        blurOnSelect
        autoComplete
        renderGroup={formatGroupLabel}
        groupBy={option => option.group}
      />
      <Preview prefab={active} />
    </>
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

const Preview = ({ prefab }: { prefab: PrefabDescription | undefined }) => {
  if (!prefab) {
    return null;
  }

  const [minX, minY, maxX, maxY] = getExtent(
    (prefab.mapPoints as { x: number; y: number }[]).concat(prefab.nodes),
  );
  const { polygons, roadStrings } = toRoadStringsAndPolygons(prefab);
  const width = Math.max(5, maxX - minX + 10);
  const height = Math.max(5, maxY - minY + 10);
  const xPadding = 10;
  const yPadding = 10;
  const roadStringColors = ['red', 'green', 'blue', 'gray', 'cyan', 'purple'];
  const svg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${minX - xPadding} ${minY - yPadding} ${width + xPadding * 2} ${
        height + yPadding * 2
      }`}
      style={{
        width: '100%',
        maxWidth: width * 4,
        maxHeight: 'calc(60vh - 300px)',
        height: height * 4,
        minWidth: 200,
        minHeight: 200,
        margin: 10,
        border: '1px solid',
        marginTop: 320,
        strokeLinecap: 'round',
      }}
    >
      <defs>
        <marker
          id="rsTriangle"
          viewBox="0 0 5 5"
          refX="1"
          refY="2.5"
          markerUnits="strokeWidth"
          markerWidth="1"
          markerHeight="1"
          orient="auto"
        >
          <path d="M 0 0 L 5 2.5 L 0 5 z" fill="#000" />
        </marker>
        <marker
          id="triangle"
          viewBox="0 0 5 5"
          refX="1"
          refY="2.5"
          markerUnits="strokeWidth"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 0 L 5 2.5 L 0 5 z" fill="#f44" />
        </marker>
        <marker
          id="triangleBlue"
          viewBox="0 0 5 5"
          refX="1"
          refY="2.5"
          markerUnits="strokeWidth"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 0 L 5 2.5 L 0 5 z" fill="#00f" />
        </marker>
      </defs>
      {polygons
        .filter(poly => poly.zIndex < 10)
        .map((poly, i) => {
          const points = poly.points.map(pos => pos.join(',')).join(' ');
          return (
            <polygon
              key={i}
              opacity={0.9}
              points={points}
              fill={mapColors[poly.color]}
            />
          );
        })}
      {roadStrings.map(({ points, offset, lanesLeft, lanesRight }, pi) => (
        <polyline
          key={`rs${pi}-${pi}`}
          stroke={roadStringColors[pi % roadStringColors.length]}
          strokeWidth={(offset && lanesLeft === lanesRight ? 4 : 1) * 4}
          opacity={0.2}
          points={points.map(pos => pos.join(',')).join(' ')}
          fill="none"
          strokeLinecap="butt"
          markerEnd="url(#rsTriangle)"
        />
      ))}
      {polygons
        .filter(poly => poly.zIndex >= 10)
        .map((poly, i) => {
          const points = poly.points.map(pos => pos.join(',')).join(' ');
          return (
            <polygon
              key={i}
              opacity={0.9}
              points={points}
              fill={mapColors[poly.color]}
            />
          );
        })}
      {prefab.nodes.map((n, i) => (
        <circle
          key={`n${i}`}
          cx={n.x}
          cy={n.y}
          r={2}
          fill={i === 0 ? '#0f0' : '#f00'}
        />
      ))}
      {prefab.mapPoints.map((p, pi) => (
        <circle key={`m${pi}`} cx={p.x} cy={p.y} r={0.5} fill="blue" />
      ))}
      <line
        stroke="gray"
        strokeDasharray={'1 1'}
        strokeWidth={0.2}
        x1={minX - 2 * xPadding}
        y1={0}
        x2={maxX + 2 * xPadding}
        y2={0}
      />
      <line
        stroke="gray"
        strokeDasharray={'1 1'}
        strokeWidth={0.2}
        x1={0}
        y1={minY - 2 * yPadding}
        x2={0}
        y2={maxY + 2 * yPadding}
      />
      {prefab.navNodes.flatMap(nn =>
        nn.connections.flatMap(conn => {
          return conn.curveIndices.map(curveIdx => {
            const curve = prefab.navCurves[curveIdx];
            const points = toSplinePoints(
              {
                position: [curve.start.x, curve.start.y],
                rotation: curve.start.rotation,
              },
              {
                position: [curve.end.x, curve.end.y],
                rotation: curve.end.rotation,
              },
            );

            return (
              <polyline
                stroke={nn.type === 'physical' ? 'red' : 'green'}
                strokeWidth={0.4}
                opacity={0.5}
                points={points.map(pos => pos.join(',')).join(' ')}
                fill="none"
                markerEnd="url(#triangle)"
              />
            );
          });
        }),
      )}
      {prefab.navCurves
        .filter((_, i) => {
          const nnCis = prefab.navNodes.flatMap(nn =>
            nn.connections.flatMap(conn => conn.curveIndices),
          );
          return !nnCis.includes(i);
        })
        .flatMap(curve => {
          const points = toSplinePoints(
            {
              position: [curve.start.x, curve.start.y],
              rotation: curve.start.rotation,
            },
            {
              position: [curve.end.x, curve.end.y],
              rotation: curve.end.rotation,
            },
          );

          return (
            <polyline
              stroke="blue"
              strokeWidth={0.4}
              opacity={0.5}
              points={points.map(pos => pos.join(',')).join(' ')}
              fill="none"
              markerEnd="url(#triangleBlue)"
            />
          );
        })}
    </svg>
  );

  return (
    <>
      {svg}
      <div
        style={{
          display: 'flex',
        }}
      >
        <pre
          style={{
            overflow: 'scroll',
            height: '50vh',
            outline: '1px solid',
            width: '100vw',
            padding: '1em',
          }}
        >
          {JSON.stringify(prefab, null, 2)}
        </pre>
        <pre
          style={{
            overflow: 'scroll',
            height: '50vh',
            outline: '1px solid',
            width: '100vw',
            padding: '1em',
          }}
        >
          {JSON.stringify(toRoadStringsAndPolygons(prefab), null, 2)}
        </pre>
      </div>
    </>
  );
};

export default App;
