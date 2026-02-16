import type { IncomingMessage, ServerResponse } from 'http';
import { env } from '../../env';
import type { Services } from '../services';

export function createHttpHandler({ services }: { services: Services }) {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/health') {
      res.writeHead(200);
      res.end('ok');
      return;
    }

    if (req.url === '/metrics' && env.METRICS_ENABLED) {
      const authHeader = req.headers.authorization;
      if (authHeader === `Bearer ${env.METRICS_COLLECTOR_BEARER_TOKEN}`) {
        res.writeHead(200);
        void services.metrics.render().then(metrics => res.end(metrics));
        return;
      }
      res.writeHead(403);
      res.end();
      return;
    }

    // Everything else: 404
    res.writeHead(404);
    res.end();
  };
}
