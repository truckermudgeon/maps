import { router } from './init';
import { navigatorRouter } from './routers/navigator-router';
import { telemetryRouter } from './routers/telemetry-router';

export const appRouter = router({
  telemetry: telemetryRouter,
  app: navigatorRouter,
});
