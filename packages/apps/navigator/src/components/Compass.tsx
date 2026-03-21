import { Sheet } from '@mui/joy';
import { memo } from 'react';

type CompassPoint = 'N' | 'S' | 'E' | 'W' | `${'N' | 'S'}${'E' | 'W'}`;

const svgSize = 110;
const center = svgSize / 2;

export const Compass = (props: {
  mode?: 'light' | 'dark';
  direction: CompassPoint;
}) => {
  const { mode = 'light', direction } = props;

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
        <Ticks mode={mode} />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="30"
          fontWeight="bold"
          fill={mode === 'light' ? 'black' : 'white'}
        >
          {direction}
        </text>
      </svg>
    </Sheet>
  );
};

const Ticks = memo(({ mode }: { mode: 'light' | 'dark' }) => {
  const padding = 2;
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
          fill={i === 0 ? 'red' : mode === 'light' ? 'black' : 'white'}
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
        stroke={'#aaa'}
        strokeWidth={2}
        transform={`rotate(${angle} ${center} ${center})`}
      />
    );
  });
});
