import {
  DirectionsBoat,
  KeyboardDoubleArrowUp,
  PlaceOutlined,
} from '@mui/icons-material';
import { assert } from '@truckermudgeon/base/assert';
import { toRadians } from '@truckermudgeon/base/geom';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { BranchType } from '@truckermudgeon/navigation/constants';

export interface LaneIconProps {
  branches: BranchType[];
  activeBranch?: BranchType;
  highlightColor?: string;
  dimColor?: string;
}

export const LaneIcon = (props: LaneIconProps) => {
  const {
    branches,
    activeBranch,
    highlightColor = '#000',
    dimColor = '#ccc',
  } = props;
  const branchArr = [...branches].sort((a, b) =>
    // sort `branches` so that `activeBranch` is last.
    a === activeBranch ? 1 : b === activeBranch ? -1 : 0,
  );
  const hasLeft = branchArr.some(b => 0 < Number(b) && Number(b) <= 10);
  const hasRight = branchArr.some(b => 10 < Number(b) && Number(b) <= 20);

  const iconType: 'single' | 'left' | 'right' | 'left-and-right' =
    branchArr.length === 1
      ? 'single'
      : hasLeft && !hasRight
        ? 'left'
        : hasRight && !hasLeft
          ? 'right'
          : 'left-and-right';

  const icons = branchArr.map((type, index) => {
    switch (type) {
      case BranchType.THROUGH: {
        let offsetX;
        let offsetY;
        switch (iconType) {
          case 'single':
            offsetX = 0;
            break;
          case 'left-and-right':
            offsetY = -1;
            break;
          case 'left':
            offsetX = 2;
            offsetY = -1;
            break;
          case 'right':
            offsetX = -2;
            offsetY = -1;
            break;
          default:
            throw new UnreachableError(iconType);
        }

        return (
          <Through
            key={index}
            offsetX={offsetX}
            offsetY={offsetY}
            color={type === activeBranch ? highlightColor : dimColor}
          />
        );
      }
      case BranchType.SLIGHT_LEFT:
      case BranchType.SLIGHT_RIGHT: {
        let offsetX;
        let stemLength;
        let angleLeg;
        const hasSameTurn =
          (BranchType.SLIGHT_LEFT && branches.includes(BranchType.LEFT)) ||
          (BranchType.SLIGHT_RIGHT && branches.includes(BranchType.RIGHT));
        switch (iconType) {
          case 'single':
            offsetX = 0;
            break;
          case 'left-and-right': {
            offsetX = type === BranchType.SLIGHT_LEFT ? -2 : 2;
            stemLength = !branches.includes(BranchType.THROUGH)
              ? !hasSameTurn
                ? 9
                : 10
              : undefined;
            break;
          }
          case 'left':
          case 'right':
            stemLength = !branches.includes(BranchType.THROUGH) ? 9 : undefined;
            break;
          default:
            throw new UnreachableError(iconType);
        }
        return (
          <Slight
            key={index}
            offsetX={offsetX}
            stemLength={stemLength}
            angleLeg={angleLeg}
            orientation={type === BranchType.SLIGHT_LEFT ? 'left' : 'right'}
            color={type === activeBranch ? highlightColor : dimColor}
          />
        );
      }
      case BranchType.LEFT:
      case BranchType.RIGHT: {
        let offsetX;
        let stemLength;
        let endLength;
        let radius;
        const hasSameSlight =
          (type === BranchType.LEFT &&
            branches.includes(BranchType.SLIGHT_LEFT)) ||
          (type === BranchType.RIGHT &&
            branches.includes(BranchType.SLIGHT_RIGHT));
        switch (iconType) {
          case 'single':
            offsetX = 0;
            break;
          case 'left-and-right':
            offsetX = type === BranchType.LEFT ? -4 : 4;
            stemLength = hasSameSlight ? 9 : 10;
            endLength = 10;
            radius = branches.includes(BranchType.THROUGH) ? 4 : undefined;
            break;
          case 'left':
          case 'right':
            offsetX = iconType === 'left' ? -2 : 2;
            stemLength = hasSameSlight ? 9 : 10;
            endLength = 10;
            radius = branches.includes(BranchType.THROUGH) ? 4 : undefined;
            break;
          default:
            throw new UnreachableError(iconType);
        }
        return (
          <Turn
            key={index}
            offsetX={offsetX}
            stemLength={stemLength}
            endLength={endLength}
            radius={radius}
            orientation={type === BranchType.LEFT ? 'left' : 'right'}
            color={type === activeBranch ? highlightColor : dimColor}
          />
        );
      }
      case BranchType.SHARP_LEFT:
      case BranchType.SHARP_RIGHT: {
        let offsetX;
        let stemLength;
        let angleLeg;
        const hasSameSlight =
          (type === BranchType.SHARP_LEFT &&
            branches.includes(BranchType.SLIGHT_LEFT)) ||
          (type === BranchType.SHARP_RIGHT &&
            branches.includes(BranchType.SLIGHT_RIGHT));
        switch (iconType) {
          case 'single':
            offsetX = 0;
            stemLength = 11;
            angleLeg = 9;
            if (!hasSameSlight) {
              stemLength++;
            }
            break;
          case 'left-and-right':
            offsetX = type === BranchType.SHARP_LEFT ? -2 : 2;
            if (
              (type === BranchType.SHARP_LEFT &&
                !branches.includes(BranchType.LEFT)) ||
              (type === BranchType.SHARP_RIGHT &&
                !branches.includes(BranchType.RIGHT))
            ) {
              stemLength = 9;
              angleLeg = 8;
            }
            if (!hasSameSlight) {
              stemLength = stemLength == null ? 9 : stemLength + 1;
            }
            break;
          case 'left':
          case 'right':
            if (
              branches.length === 2 &&
              branches.includes(BranchType.THROUGH)
            ) {
              stemLength = 10;
              angleLeg = 9;
            }
            if (!hasSameSlight) {
              stemLength = stemLength == null ? 9 : stemLength + 1;
            }
            break;
          default:
            throw new UnreachableError(iconType);
        }
        return (
          <Sharp
            key={index}
            offsetX={offsetX}
            stemLength={stemLength}
            angleLeg={angleLeg}
            orientation={type === BranchType.SHARP_LEFT ? 'left' : 'right'}
            color={type === activeBranch ? highlightColor : dimColor}
          />
        );
      }
      case BranchType.U_TURN_LEFT:
      case BranchType.U_TURN_RIGHT: {
        let offsetX;
        let offsetY;
        let stemLength;
        let radius;
        let endLength;
        const hasSameTurn =
          (type === BranchType.U_TURN_LEFT &&
            branches.includes(BranchType.LEFT)) ||
          (type === BranchType.U_TURN_RIGHT &&
            branches.includes(BranchType.RIGHT));
        switch (iconType) {
          case 'single':
            break;
          case 'left-and-right':
            offsetX = type === BranchType.U_TURN_LEFT ? -5 : 5;
            stemLength = 6;
            endLength = 4;
            radius = 3.5;
            offsetY = -1;
            if (hasSameTurn) {
              radius--;
              endLength += 2;
            }
            break;
          case 'left':
          case 'right':
            offsetX = type === BranchType.U_TURN_LEFT ? -3 : 3;
            offsetY = -1;
            stemLength = 6;
            endLength = 4;
            radius = 3.5;
            if (hasSameTurn) {
              radius--;
              endLength += 2;
            }
            break;
          default:
            throw new UnreachableError(iconType);
        }
        return (
          <Reverse
            key={index}
            offsetX={offsetX}
            offsetY={offsetY}
            stemLength={stemLength}
            radius={radius}
            endLength={endLength}
            orientation={type === BranchType.U_TURN_LEFT ? 'left' : 'right'}
            color={type === activeBranch ? highlightColor : dimColor}
          />
        );
      }
      case BranchType.ROUND_BR:
      case BranchType.ROUND_R:
      case BranchType.ROUND_TR:
      case BranchType.ROUND_T:
      case BranchType.ROUND_TL:
      case BranchType.ROUND_L:
      case BranchType.ROUND_BL:
      case BranchType.ROUND_B:
        assert(branches.length === 1, 'ROUND_X must appear alone');
        return (
          <Roundabout
            key={index}
            type={type}
            highlightColor={highlightColor}
            dimColor={dimColor}
          />
        );
      case BranchType.ROUND_EXIT:
        assert(branches.length === 1, 'ROUND_EXIT must appear alone');
        return (
          <ExitRoundabout
            key={index}
            highlightColor={highlightColor}
            dimColor={dimColor}
          />
        );
      case BranchType.MERGE:
        assert(branches.length === 1, 'MERGE must appear alone');
        return (
          <Merge
            key={index}
            color={type === activeBranch ? highlightColor : dimColor}
          />
        );
      case BranchType.DEPART:
        assert(branches.length === 1, 'DEPART must appear alone');
        return (
          <KeyboardDoubleArrowUp
            viewBox={'-5 -5 34 34'}
            style={{ fill: dimColor }}
            key={index}
          />
        );
      case BranchType.ARRIVE:
        assert(branches.length === 1, 'ARRIVE must appear alone');
        return (
          <PlaceOutlined
            viewBox={'-5 -5 34 34'}
            style={{ fill: dimColor }}
            key={index}
          />
        );
      case BranchType.FERRY:
        assert(branches.length === 1, 'FERRY must appear alone');
        return (
          <DirectionsBoat
            viewBox={'-5 -5 34 34'}
            style={{ fill: dimColor }}
            key={index}
          />
        );
      default:
        throw new UnreachableError(type);
    }
  });

  return (
    <svg viewBox="0 0 24 24">
      <defs>
        <g
          id="arrow"
          transform-origin="0 0"
          transform="translate(0,1.414) rotate(135) "
        >
          <path fill="none" strokeWidth="2" d="M0,-4 0,0 4,0" />
        </g>
      </defs>

      {icons}
    </svg>
  );
};

interface BaseIconProps {
  offsetX?: number;
  offsetY?: number;
  orientation?: 'left' | 'right';
  color?: string;
}

interface ThroughProps extends BaseIconProps {
  stemLength?: number;
}
const Through = (props: ThroughProps) => {
  const anchor = [12, 21];
  const {
    color = 'black',
    orientation = 'left',
    offsetX = 0,
    offsetY = 0,
    stemLength = 18,
  } = props;
  const arrow = [anchor[0], anchor[1] - stemLength];
  return (
    <g
      stroke={color}
      transform-origin="12 12"
      transform={
        `translate(${offsetX}, ${offsetY})` +
        `scale(${orientation === 'left' ? '' : '-'}1, 1)`
      }
    >
      <path
        fill="none"
        strokeWidth="2"
        d={`M${anchor.join()} v-${stemLength - 1.414}`}
      />
      <use href="#arrow" x={arrow[0]} y={arrow[1]} />
    </g>
  );
};

interface SlightProps extends BaseIconProps {
  stemLength?: number;
  angleLeg?: number;
}
const Slight = (props: SlightProps) => {
  const anchor = [14, 20];
  const {
    color = 'black',
    orientation = 'left',
    offsetX = 0,
    offsetY = 0,
    stemLength = 8,
    angleLeg = 8,
  } = props;
  const arrow = [anchor[0] - angleLeg, anchor[1] - stemLength - angleLeg];
  return (
    <g
      stroke={color}
      transform-origin="12 12"
      transform={
        `translate(${offsetX}, ${offsetY})` +
        `scale(${orientation === 'left' ? '' : '-'}1, 1)`
      }
    >
      <path
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        d={
          `M${anchor.join()}` +
          `v-${stemLength}` +
          `l-${angleLeg - 1.414},-${angleLeg - 1.414}`
        }
      />
      <use
        href="#arrow"
        transform-origin={arrow.join(' ')}
        transform="rotate(-45)"
        x={arrow[0]}
        y={arrow[1]}
      />
    </g>
  );
};

interface TurnProps extends BaseIconProps {
  stemLength?: number;
  endLength?: number;
  radius?: number;
}

const Turn = (props: TurnProps) => {
  const anchor = [16, 20];
  const {
    color = 'black',
    orientation = 'left',
    offsetX = 0,
    offsetY = 0,
    stemLength = 10,
    radius = 1,
    endLength = 12,
  } = props;
  const arrow = [anchor[0] - endLength, anchor[1] - stemLength];
  return (
    <g
      stroke={color}
      transform-origin="12 12"
      transform={
        `translate(${offsetX}, ${offsetY})` +
        `scale(${orientation === 'left' ? '' : '-'}1, 1)`
      }
    >
      <path
        fill="none"
        strokeWidth="2"
        d={
          `M${anchor.join()}` +
          `v-${stemLength - radius}` +
          `a${radius} ${radius} 0 0 0 -${radius},-${radius}` +
          `h-${endLength - radius - 1.414}`
        }
      />
      <use
        href="#arrow"
        x={arrow[0]}
        y={arrow[1]}
        transform-origin={arrow.join(' ')}
        transform="rotate(-90)"
      />
    </g>
  );
};

interface SharpProps extends BaseIconProps {
  stemLength?: number;
  angleLeg?: number;
}
const Sharp = (props: SharpProps) => {
  const anchor = [14, 20];
  const {
    color = 'black',
    orientation = 'left',
    offsetX = 0,
    offsetY = 0,
    stemLength = 8,
    angleLeg = 8,
  } = props;
  const arrow = [anchor[0] - angleLeg, anchor[1] - stemLength + angleLeg];
  return (
    <g
      stroke={color}
      transform-origin="12 12"
      transform={
        `translate(${offsetX}, ${offsetY})` +
        `scale(${orientation === 'left' ? '' : '-'}1, 1)`
      }
    >
      <path
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        d={
          `M${anchor.join()}` +
          `v-${stemLength}` +
          `l-${angleLeg - 1.414},${angleLeg - 1.414}`
        }
      />
      <use
        href="#arrow"
        x={arrow[0]}
        y={arrow[1]}
        transform-origin={arrow.join(' ')}
        transform="rotate(-135)"
      />
    </g>
  );
};

interface ReverseProps extends BaseIconProps {
  stemLength?: number;
  radius?: number;
  endLength?: number;
}
const Reverse = (props: ReverseProps) => {
  const anchor = [17, 21];
  const {
    color = 'black',
    orientation = 'left',
    offsetX = 0,
    offsetY = 0,
    stemLength = 12,
    radius = 5,
    endLength = 8,
  } = props;
  const arrow = [anchor[0] - radius * 2, anchor[1] - stemLength + endLength];

  return (
    <g
      stroke={color}
      transform-origin="12 12"
      transform={
        `translate(${offsetX}, ${offsetY})` +
        `scale(${orientation === 'left' ? '' : '-'}1, 1)`
      }
    >
      <path
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        d={
          `M${anchor.join()} v-${stemLength}` +
          `a${radius} ${radius} 0 1 0 -${radius * 2},0` +
          `v${endLength - 1.414}`
        }
      />
      <use
        href="#arrow"
        x={arrow[0]}
        y={arrow[1]}
        transform-origin={arrow.join(' ')}
        transform="rotate(180)"
      />
    </g>
  );
};

interface MergeProps extends BaseIconProps {
  stemLength?: number;
  baseLeg?: number;
}
const Merge = (props: MergeProps) => {
  const {
    color = 'black',
    offsetX = 0,
    offsetY = 0,
    stemLength = 11,
    baseLeg = 6,
  } = props;
  const arrow = [12, 3];
  return (
    <g
      stroke={color}
      transform-origin="12 12"
      transform={`translate(${offsetX}, ${offsetY})`}
    >
      <path
        fill="none"
        strokeWidth="2"
        d={
          `M${arrow[0]},${arrow[1] + 1.414}` +
          `V${arrow[1] + stemLength}` +
          `l-${baseLeg},${baseLeg}` +
          `m${baseLeg},-${baseLeg}` +
          `l${baseLeg},${baseLeg}`
        }
      />
      <use href="#arrow" x={arrow[0]} y={arrow[1]} />
    </g>
  );
};

interface RoundaboutProps {
  type:
    | BranchType.ROUND_BR
    | BranchType.ROUND_R
    | BranchType.ROUND_TR
    | BranchType.ROUND_T
    | BranchType.ROUND_TL
    | BranchType.ROUND_L
    | BranchType.ROUND_BL
    | BranchType.ROUND_B;
  highlightColor: string;
  dimColor: string;
}

const roundaboutDegrees: Record<RoundaboutProps['type'], number> = {
  [BranchType.ROUND_BR]: 45,
  [BranchType.ROUND_R]: 90,
  [BranchType.ROUND_TR]: 135,
  [BranchType.ROUND_T]: 180,
  [BranchType.ROUND_TL]: 225,
  [BranchType.ROUND_L]: 270,
  [BranchType.ROUND_BL]: 315,
  [BranchType.ROUND_B]: 359,
};

const Roundabout = (props: RoundaboutProps) => {
  const { type, highlightColor, dimColor } = props;
  const center = 12;
  const radius = 4.5;
  const strokeWidth = 2;

  const degrees = roundaboutDegrees[type];
  const startAngle = 90;
  const endAngle = startAngle - degrees; // CCW means decreasing angle

  const start = {
    x: center + radius * Math.cos(toRadians(startAngle)),
    y: center + radius * Math.sin(toRadians(startAngle)),
  };
  const end = {
    x: center + radius * Math.cos(toRadians(endAngle)),
    y: center + radius * Math.sin(toRadians(endAngle)),
  };
  const arcPath =
    `M ${start.x} ${start.y}` +
    `A ${radius} ${radius} 0 ${degrees > 180 ? 1 : 0} 0 ${end.x} ${end.y}`;

  const stemLength = 5;
  const arrowStemStart = {
    x: end.x + (-strokeWidth / 2) * Math.cos(toRadians(endAngle)),
    y: end.y + (-strokeWidth / 2) * Math.sin(toRadians(endAngle)),
  };
  const arrowStemEnd = {
    x:
      end.x +
      (-strokeWidth / 2 + stemLength + 1) * Math.cos(toRadians(endAngle)),
    y:
      end.y +
      (-strokeWidth / 2 + stemLength + 1) * Math.sin(toRadians(endAngle)),
  };
  const arrow = {
    x: end.x + (stemLength + 2) * Math.cos(toRadians(endAngle)),
    y: end.y + (stemLength + 2) * Math.sin(toRadians(endAngle)),
  };

  return (
    <g stroke={highlightColor} strokeWidth={strokeWidth}>
      <circle
        stroke={dimColor}
        fill={'none'}
        cx={center}
        cy={center}
        r={radius}
      />
      <path fill="none" d={arcPath} />
      <line
        x1={start.x}
        y1={start.y - strokeWidth / 2}
        x2={start.x}
        y2={start.y - strokeWidth / 2 + stemLength}
      />
      <line
        x1={arrowStemStart.x}
        y1={arrowStemStart.y}
        x2={arrowStemEnd.x}
        y2={arrowStemEnd.y}
      />
      <use
        href="#arrow"
        x={arrow.x}
        y={arrow.y}
        transform-origin={`${arrow.x} ${arrow.y}`}
        transform={`rotate(${180 - degrees})`}
      />
    </g>
  );
};

const ExitRoundabout = (props: {
  highlightColor: string;
  dimColor: string;
}) => {
  const { highlightColor, dimColor } = props;
  const center = 12;
  const radius = 4.5;
  const strokeWidth = 2;

  // Arc from bottom-right (45°) CCW to top (-90°), 135° sweep, no entry stem
  const startAngle = 45;
  const endAngle = -90;

  const start = {
    x: center + radius * Math.cos(toRadians(startAngle)),
    y: center + radius * Math.sin(toRadians(startAngle)),
  };
  const end = {
    x: center + radius * Math.cos(toRadians(endAngle)),
    y: center + radius * Math.sin(toRadians(endAngle)),
  };
  const arcPath =
    `M ${start.x} ${start.y}` + `A ${radius} ${radius} 0 0 0 ${end.x} ${end.y}`;

  const stemLength = 5;
  const arrowStemStart = {
    x: end.x + (-strokeWidth / 2) * Math.cos(toRadians(endAngle)),
    y: end.y + (-strokeWidth / 2) * Math.sin(toRadians(endAngle)),
  };
  const arrowStemEnd = {
    x:
      end.x +
      (-strokeWidth / 2 + stemLength + 1) * Math.cos(toRadians(endAngle)),
    y:
      end.y +
      (-strokeWidth / 2 + stemLength + 1) * Math.sin(toRadians(endAngle)),
  };
  const arrow = {
    x: end.x + (stemLength + 2) * Math.cos(toRadians(endAngle)),
    y: end.y + (stemLength + 2) * Math.sin(toRadians(endAngle)),
  };

  return (
    <g stroke={highlightColor} strokeWidth={strokeWidth}>
      <circle
        stroke={dimColor}
        fill={'none'}
        cx={center}
        cy={center}
        r={radius}
      />
      <path fill="none" d={arcPath} />
      <line
        x1={arrowStemStart.x}
        y1={arrowStemStart.y}
        x2={arrowStemEnd.x}
        y2={arrowStemEnd.y}
      />
      <use href="#arrow" x={arrow.x} y={arrow.y} />
    </g>
  );
};
