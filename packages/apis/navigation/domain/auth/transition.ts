import { AuthState } from './auth-state';

const AUTH_TRANSITIONS: Record<AuthState, AuthState[]> = {
  [AuthState.UNAUTHENTICATED]: [
    AuthState.DEVICE_PROVISIONAL_WITHOUT_CODE,
    AuthState.VIEWER_AUTHENTICATED,
    // N.B.: AuthState.DEVICE_AUTHENTICATED is *not* allowed. all devices
    // must go through provisioning. Note that reconnection is not a state
    // transition: it's a state restoration.
  ],
  [AuthState.DEVICE_PROVISIONAL_WITHOUT_CODE]: [
    AuthState.DEVICE_PROVISIONAL_WITH_CODE,
  ],
  [AuthState.DEVICE_PROVISIONAL_WITH_CODE]: [AuthState.DEVICE_AUTHENTICATED],
  [AuthState.DEVICE_AUTHENTICATED]: [],
  [AuthState.VIEWER_AUTHENTICATED]: [],
};

export function transition<T extends { state: AuthState }>(
  authCtx: T,
  next: AuthState,
): authCtx is T & { state: typeof next } {
  const allowed = AUTH_TRANSITIONS[authCtx.state] ?? [];

  if (!allowed.includes(next)) {
    throw new Error(`Illegal transition: ${authCtx.state} → ${next}`);
  }

  authCtx.state = next;
  return true;
}
