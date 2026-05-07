import type { IReactionDisposer } from 'mobx';
import type { CameraReactionDeps } from './camera';
import { wireCameraReactions } from './camera';
import type { RouteReactionDeps } from './route';
import { wireRouteReactions } from './route';

export type ReactionDeps = CameraReactionDeps & RouteReactionDeps;

/**
 * Composes the per-domain reaction wirings into a single call site
 * that create-app.tsx invokes. Each per-domain function lives under
 * `reactions/`.
 */
export function wireAppReactions(deps: ReactionDeps): IReactionDisposer[] {
  return [...wireCameraReactions(deps), ...wireRouteReactions(deps)];
}
