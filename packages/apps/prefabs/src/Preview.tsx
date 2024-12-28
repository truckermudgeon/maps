import { getExtent } from '@truckermudgeon/base/geom';
import {
  calculateLaneInfo,
  toRoadStringsAndPolygons,
} from '@truckermudgeon/map/prefabs';
import type { PrefabDescription } from '@truckermudgeon/map/types';

const mapColors = {
  [0]: '#eaeced', // road
  [1]: '#e6cc9f', // light
  [2]: '#d8a54e', // dark
  [3]: '#b1ca9b', // green
  // unexpected "nav" colors
  [4]: '#ff00ff',
  [5]: '#ff00ff',
  [6]: '#ff00ff',
  [7]: '#ff00ff',
  [8]: '#ff00ff',
};

export const Preview = ({ prefab }: { prefab: PrefabDescription }) => {
  const [minX, minY, maxX, maxY] = getExtent(
    (prefab.mapPoints as { x: number; y: number }[])
      .concat(prefab.nodes)
      .concat(prefab.navCurves.flatMap(nc => [nc.start, nc.end])),
  );
  const { polygons, roadStrings } = toRoadStringsAndPolygons(prefab);
  const width = Math.max(5, maxX - minX);
  const height = Math.max(5, maxY - minY);
  const xPadding = 10;
  const yPadding = 10;
  const roadStringColors = ['red', 'green', 'blue', 'gray', 'cyan', 'purple'];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${minX - xPadding} ${minY - yPadding} ${width + xPadding * 2} ${
        height + yPadding * 2
      }`}
      style={{
        border: '1px solid',
        strokeLinecap: 'round',
        width: '100%',
        height: '100%',
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
      {calculateLaneInfo(prefab)
        .entries()
        .toArray()
        .flatMap(([nodeIndex, lanes]) =>
          lanes.flatMap((lane, laneIndex) =>
            lane.branches.flatMap(({ curvePoints }, branchIndex) => (
              <polyline
                key={`lane-${nodeIndex}-${laneIndex}-${branchIndex}`}
                id={`lane-${nodeIndex}-${laneIndex}-${branchIndex}`}
                stroke="blue"
                strokeWidth={0.4}
                opacity={0.5}
                points={curvePoints.map(p => p.join(',')).join(' ')}
                fill="none"
                markerEnd="url(#triangleBlue)"
              />
            )),
          ),
        )}
    </svg>
  );
};
