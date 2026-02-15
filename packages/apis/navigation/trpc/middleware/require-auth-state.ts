import { TRPCError } from '@trpc/server';
import type { AuthState } from '../../domain/auth/auth-state';
import { middleware } from '../init';

export const requireAuthState = (allowed: AuthState[]) =>
  middleware(async ({ ctx, next }) => {
    if (!allowed.includes(ctx.auth.state)) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: `AuthState ${ctx.auth.state} not permitted`,
      });
    }

    return next();
  });
