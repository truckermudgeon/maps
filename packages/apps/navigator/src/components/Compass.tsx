import { Sheet } from '@mui/joy';
import { memo } from 'react';
import { toCompassPoint } from '../base/to-compass-point';

const svgSize = 105;
const center = svgSize / 2;
const black = '#32383E';

export const Compass = (props: {
  mode?: 'light' | 'dark';
  // (-180, 180] CW, 0 is north
  bearing: number;
}) => {
  const { mode = 'light', bearing } = props;

  return (
    <Sheet
      variant={'outlined'}
      sx={{
        width: '3.5em',
        height: '3.5em',
        //width: '35em',
        //height: '35em',
        borderRadius: '50%',
        fontWeight: 'bold',
        display: 'flex',
        boxShadow: 'md',
        cursor: 'pointer',
        //'rgba(0, 0, 0, 0.2) 0 3px 5px -1px, rgba(0, 0, 0, 0.14) 0 6px 10px 0, rgba(0, 0, 0, 0.12) 0 1px 18px 0',
      }}
    >
      <svg viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <g
          transform={`rotate(${-bearing} ${center} ${center})`}
          style={{
            transition: 'transform 0.4s ease',
          }}
        >
          <Ticks mode={mode} />
        </g>
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="30"
          fontWeight="bold"
          fill={mode === 'light' ? black : 'white'}
        >
          {toCompassPoint(bearing)}
        </text>
      </svg>
    </Sheet>
  );
};

const Ticks = memo(({ mode }: { mode: 'light' | 'dark' }) => {
  const padding = 4;
  const numTicks = 16;
  return Array.from({ length: numTicks }, (_, i) => {
    const angle = (i / numTicks) * 360;

    const isCardinal = i % 4 === 0;
    const tickLength = isCardinal ? 14 : 8;

    if (isCardinal) {
      const tipY = padding;
      const baseY = tipY + tickLength;
      const baseWidth = i === 0 ? tickLength : tickLength / 2;

      return (
        <polygon
          key={i}
          points={`
            ${center},${tipY}
            ${center - baseWidth / 2},${baseY}
            ${center + baseWidth / 2},${baseY}
          `}
          fill={i === 0 ? 'red' : mode === 'light' ? black + 'bb' : 'white'}
          transform={`rotate(${angle} ${center} ${center})`}
        />
      );
    }

    return (
      <line
        key={i}
        x1={center}
        y1={padding}
        x2={center}
        y2={padding + tickLength}
        stroke={mode === 'light' ? '#bbb' : '#666'}
        strokeWidth={2}
        transform={`rotate(${angle} ${center} ${center})`}
      />
    );
  });
});
