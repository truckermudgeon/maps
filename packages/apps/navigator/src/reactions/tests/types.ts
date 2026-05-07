import type { CameraStore, RouteStore, SessionStore } from '../../stores/types';

/**
 * Aggregate store type used only by reaction/handler test fixtures
 * that build a single fake object satisfying three store interfaces.
 * Production code never sees a merged store — RootStore composes the
 * separate impls.
 */
export interface AppStore extends SessionStore, CameraStore, RouteStore {}
