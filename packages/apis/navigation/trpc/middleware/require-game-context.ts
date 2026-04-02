import { TRPCError } from '@trpc/server';
import type { SessionActor } from '../../domain/session-actor';
import { middleware } from '../init';

type SessionActorWithGameContext = SessionActor & {
  gameContext: NonNullable<SessionActor['gameContext']>;
};

export const requireGameContext = middleware(async ({ ctx, next }) => {
  if (ctx.type !== 'navigator') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'No Navigator context',
    });
  }

  const sessionActor = ctx.sessionActor;
  if (sessionActor == null) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Actor not present',
    });
  }

  if (sessionActor.gameContext == null) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Game context not present',
    });
  }

  return next({
    ctx: {
      ...ctx,
      sessionActor: sessionActor as SessionActorWithGameContext,
    },
  });
});
