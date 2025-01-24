import { CircularProgress } from '@mui/joy';
import React from 'react';

export function withLoading<P>(
  BaseComponent: React.ComponentType<P>,
): (props: P & { isLoading: boolean }) => React.JSX.Element {
  return function (props: P & { isLoading: boolean }) {
    return props.isLoading ? (
      <CircularProgress size={'lg'} />
    ) : (
      <BaseComponent {...props} />
    );
  };
}
