// CIDRs for Cloudflare IPv4 + IPv6
import type { IncomingMessage } from 'http';
import ipaddr from 'ipaddr.js';
import { env } from '../../env';

// https://www.cloudflare.com/ips/
const CLOUDFLARE_CIDRS = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
].map(ipaddr.parseCIDR);

function isFromCloudflare(ip: string) {
  const address = ipaddr.parse(ip);
  return CLOUDFLARE_CIDRS.filter(cidr => cidr[0].kind === address.kind).some(
    cidr => address.match(cidr),
  );
}

export function getClientIp(req: IncomingMessage): string | undefined {
  const peerIp = req.socket.remoteAddress;
  console.log('socket.remoteAddress', peerIp);

  if (peerIp && isFromCloudflare(peerIp)) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string') {
      console.log('peerIp and connecting ip', peerIp, cfIp);
      return cfIp;
    }
  }

  if (env.TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') {
      console.log('xff', xff);
      return xff.split(',')[0].trim();
    }
  }

  return peerIp;
}
