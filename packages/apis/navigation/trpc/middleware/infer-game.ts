import { AuthState } from '../../domain/auth/auth-state';
import { navigatorKeys } from '../../infra/kv/store';
import type { TruckSimTelemetry } from '../../types';
import type { Context } from '../context';

export async function inferGame(
  ctx: Context,
  path: string,
): Promise<'ats' | 'ets2' | 'unknown'> {
  switch (ctx.type) {
    case 'telemetry':
      switch (path) {
        case 'telemetry.push': {
          if (ctx.auth.state === AuthState.DEVICE_AUTHENTICATED) {
            const telemetry: TruckSimTelemetry | undefined =
              (await ctx.services.kv.get(
                navigatorKeys.telemetry(ctx.auth.deviceId),
              )) ?? undefined;
            const game = telemetry?.game.game.name;
            return game === 'ats' || game === 'ets2' ? game : 'unknown';
          }
          return 'unknown';
        }
        default:
          return 'unknown';
      }
    case 'navigator':
      if (ctx.auth.state === AuthState.VIEWER_AUTHENTICATED) {
        const telemetryId =
          (await ctx.services.kv.get(
            navigatorKeys.viewerId(ctx.auth.viewerId),
          )) ?? undefined;
        if (telemetryId != null) {
          const telemetry: TruckSimTelemetry | undefined =
            (await ctx.services.kv.get(navigatorKeys.telemetry(telemetryId))) ??
            undefined;
          const game = telemetry?.game.game.name;
          return game === 'ats' || game === 'ets2' ? game : 'unknown';
        }
      }
      return 'unknown';
    default:
      return 'unknown';
  }
}
