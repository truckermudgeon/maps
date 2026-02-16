import { TRPCError } from '@trpc/server';
import { AuthState } from '../../domain/auth/auth-state';
import { navigatorKeys } from '../../infra/kv/store';
import { middleware } from '../init';

export const requireSessionActor = middleware(async ({ ctx, next }) => {
  if (ctx.type !== 'navigator') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'No Navigator context',
    });
  }

  if (ctx.auth.state !== AuthState.VIEWER_AUTHENTICATED) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Unauthenticated Viewer',
    });
  }

  const telemetryId = await ctx.services.kv.get(
    navigatorKeys.viewerId(ctx.auth.viewerId),
  );
  if (!telemetryId) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: [
        `Unknown viewer id.`,
        `key(${ctx.wsConnectionState.websocketKey})`,
        `connectedAt(${ctx.wsConnectionState.connectedAt})`,
      ].join(' '),
    });
  }

  const actor = ctx.services.sessionActors.get(telemetryId);
  if (!actor) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Session not activated',
    });
  }

  return next({
    ctx: {
      ...ctx,
      sessionActor: actor,
    },
  });
});
