import { Preconditions } from '@truckermudgeon/base/precon';
import type { ExpressionSpecification } from 'maplibre-gl';

const lineColors = {
  case: {
    before: 'hsl(204,0%,60%)',
    after: 'hsl(204,100%,40%)',
  },
  line: {
    before: 'hsl(204,0%,80%)',
    after: 'hsl(204,100%,50%)',
  },
  animatedPrimaryCase: {
    before: 'hsl(204,100%,40%)',
    after: 'rgba(0, 0, 0, 0)',
  },
  animatedPrimaryLine: {
    before: 'hsl(204,100%,50%)',
    after: 'rgba(0, 0, 0, 0)',
  },
  animatedSecondaryCase: {
    before: 'hsl(204,80%,70%)',
    after: 'rgba(0, 0, 0, 0)',
  },
  animatedSecondaryLine: {
    before: 'hsl(204,80%,80%)',
    after: 'rgba(0, 0, 0, 0)',
  },
};

export const lineGradientExpression = ({
  lineType,
  progress,
}: {
  lineType: keyof typeof lineColors;
  progress: number;
}) => {
  Preconditions.checkArgument(0 <= progress && progress <= 1);
  const { before, after } = lineColors[lineType];
  return [
    'step',
    ['line-progress'],
    before,
    progress,
    after,
  ] satisfies ExpressionSpecification;
};
