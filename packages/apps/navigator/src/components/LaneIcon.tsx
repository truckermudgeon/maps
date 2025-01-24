import { assert } from '@truckermudgeon/base/assert';
import { UnreachableError } from '@truckermudgeon/base/precon';
import { BranchType } from '@truckermudgeon/navigation/constants';

interface LaneIconProps {
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
  const hasLeft = branchArr.some(b => 0 < Number(b) && Number(b) < 10);
  const hasRight = branchArr.some(b => Number(b) >= 10);

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
      case BranchType.MERGE:
        assert(branches.length === 1, 'MERGE must appear alone');
        return (
          <Merge
            key={index}
            color={type === activeBranch ? highlightColor : dimColor}
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
