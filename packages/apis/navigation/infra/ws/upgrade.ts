import { UnreachableError } from '@truckermudgeon/base/precon';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import type { WebSocketServer } from 'ws';
import { env } from '../../env';
import { getClientIp } from '../http/get-client-ip';
import { UpgradeRejectionReason } from '../metrics/ws';
import type { Services } from '../services';

export async function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  opts: {
    wss: WebSocketServer;
    services: Services;
  },
) {
  console.log('upgrade request', req.url);
  const metrics = opts.services.metrics.ws;
  if (
    req.url !== '/telemetry' &&
    req.url !== '/navigator' &&
    req.url !== '/navigator?connectionParams=1'
  ) {
    console.error('upgrading on unexpected url');
    metrics.upgradesRejected.inc({ reason: UpgradeRejectionReason.BAD_URL });
    rejectUpgrade(socket, 404, 'Not Found');
    return;
  }

  let maybeClientHeadersOk = true;
  switch (req.url) {
    case '/telemetry': {
      maybeClientHeadersOk =
        req.headers.origin == null &&
        (req.headers['user-agent'] === 'node' ||
          req.headers['user-agent'] == null);
      break;
    }
    case '/navigator':
    case '/navigator?connectionParams=1':
      maybeClientHeadersOk =
        req.headers.origin === env.ALLOWED_ORIGIN &&
        req.headers['user-agent'] != null &&
        req.headers['user-agent'] !== 'node';
      break;
    default:
      throw new UnreachableError(req.url);
  }

  if (!maybeClientHeadersOk) {
    console.error('unexpected client headers', {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
    });
    metrics.upgradesRejected.inc({
      reason: UpgradeRejectionReason.BAD_CLIENT_HEADERS,
    });
    rejectUpgrade(socket, 404, 'Not Found');
    return;
  }

  const ip = getClientIp(req);
  if (!ip) {
    metrics.upgradesRejected.inc({ reason: UpgradeRejectionReason.MISSING_IP });
    rejectUpgrade(socket, 400, 'missing IP');
    return;
  }

  // check concurrent connections by ip
  if (!(await opts.services.rateLimit.wsConnect(ip))) {
    metrics.upgradesRejected.inc({
      reason: UpgradeRejectionReason.TOO_MANY_CONCURRENT_CONNECTIONS,
    });
    rejectUpgrade(socket, 429, 'Too Many Requests');
    return;
  }

  // check upgrade request rate
  if (!(await opts.services.rateLimit.wsUpgrade(ip))) {
    metrics.upgradesRejected.inc({
      reason: UpgradeRejectionReason.RATE_LIMIT,
    });
    rejectUpgrade(socket, 429, 'Too Many Requests');
    return;
  }

  opts.wss.handleUpgrade(req, socket, head, ws => {
    ws.once('close', () => void opts.services.rateLimit.wsDisconnect(ip));
    opts.wss.emit('connection', ws, req, {
      ip,
      websocketKey: req.headers['sec-websocket-key'],
    });
  });
}

function rejectUpgrade(socket: Duplex, status: number, message: string) {
  console.log('rejecting upgrade', status, message);
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\n` + 'Connection: close\r\n' + '\r\n',
  );
  socket.destroy();
}
