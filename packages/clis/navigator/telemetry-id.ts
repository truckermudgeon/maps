import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SERVICE = 'trucksim-navigator';
const ACCOUNT = 'device-private-key';

export interface TelemetryIdManager {
  getPublicKey(): Promise<crypto.webcrypto.JsonWebKey>;
  getTelemetryId(): string | undefined;
  storeTelemetryId(telemetryId: string): void;
  signChallenge(challengeB64: string): Promise<string>;
  createReconnectRequest(): Promise<{
    telemetryId: string;
    timestamp: number;
    signature: string;
  }>;
}

const defaultConfigDir = path.join(
  os.homedir(),
  '.config',
  'trucksim-navigator',
);

export function makeTelemetryIdManager(
  configDir: string = defaultConfigDir,
): TelemetryIdManager {
  const telemetryIdPath = path.join(configDir, 'telemetry-id.txt');
  const publicKeyPath = path.join(configDir, 'publicKey.json');
  const privateKeyPath = path.join(configDir, 'privateKey.txt');

  async function getPublicKey(): Promise<crypto.webcrypto.JsonWebKey> {
    if (fs.existsSync(publicKeyPath)) {
      try {
        const results: unknown = JSON.parse(
          fs.readFileSync(publicKeyPath, 'utf-8'),
        );
        await crypto.subtle.importKey(
          'jwk',
          results as crypto.webcrypto.JsonWebKey,
          'Ed25519',
          true,
          ['verify'],
        );
        return results as crypto.webcrypto.JsonWebKey;
      } catch (e) {
        console.error(e);
        throw new Error(
          `could not read ${publicKeyPath}. try deleting it to force re-creation.`,
        );
      }
    } else {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      const keyPair = await crypto.subtle.generateKey(
        { name: 'Ed25519', namedCurve: 'Ed25519' },
        true,
        ['sign', 'verify'],
      );
      const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const privateKey = await crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey,
      );
      const privateKeyString = Buffer.from(privateKey).toString('base64url');
      //await keytar.setPassword(SERVICE, ACCOUNT, privateKeyString);
      fs.writeFileSync(privateKeyPath, privateKeyString, {
        mode: 0o400,
      });
      fs.writeFileSync(publicKeyPath, JSON.stringify(publicKey, null, 2), {
        mode: 0o400,
      });
      return publicKey;
    }
  }

  function getTelemetryId(): string | undefined {
    if (fs.existsSync(telemetryIdPath)) {
      return fs.readFileSync(telemetryIdPath, 'utf-8');
    } else {
      return undefined;
    }
  }

  function storeTelemetryId(telemetryId: string): void {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(telemetryIdPath, telemetryId);
  }

  async function signChallenge(challengeB64: string): Promise<string> {
    //const privateKeyString = await keytar.getPassword(SERVICE, ACCOUNT);
    const privateKeyString = fs.readFileSync(privateKeyPath, 'utf-8');
    if (!privateKeyString) {
      throw new Error('private key not found');
    }

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      Buffer.from(privateKeyString, 'base64url'),
      'Ed25519',
      true,
      ['sign'],
    );
    const buffer = await crypto.subtle.sign(
      'Ed25519',
      privateKey,
      Buffer.from(challengeB64, 'base64url'),
    );
    return Buffer.from(buffer).toString('base64url');
  }

  async function createReconnectRequest(): Promise<{
    telemetryId: string;
    timestamp: number;
    signature: string;
  }> {
    //const privateKeyString = await keytar.getPassword(SERVICE, ACCOUNT);
    const privateKeyString = fs.readFileSync(privateKeyPath, 'utf-8');
    if (!privateKeyString) {
      throw new Error('private key not found');
    }

    const telemetryId = getTelemetryId();
    if (!telemetryId) {
      throw new Error('telemetry id not found');
    }

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      Buffer.from(privateKeyString, 'base64url'),
      'Ed25519',
      true,
      ['sign'],
    );
    const timestamp = Date.now();
    const buffer = await crypto.subtle.sign(
      'Ed25519',
      privateKey,
      Buffer.from(JSON.stringify({ telemetryId, timestamp }), 'base64url'),
    );
    const signature = Buffer.from(buffer).toString('base64url');
    return {
      telemetryId,
      timestamp,
      signature,
    };
  }

  return {
    getPublicKey,
    getTelemetryId,
    storeTelemetryId,
    signChallenge,
    createReconnectRequest,
  };
}

// Default-bound manager for production callers; tests construct their own
// manager with a temp dir to avoid clobbering the real config.
const defaultManager = makeTelemetryIdManager();

export const getPublicKey = (): Promise<crypto.webcrypto.JsonWebKey> =>
  defaultManager.getPublicKey();
export const getTelemetryId = (): string | undefined =>
  defaultManager.getTelemetryId();
export const storeTelemetryId = (telemetryId: string): void =>
  defaultManager.storeTelemetryId(telemetryId);
export const signChallenge = (challengeB64: string): Promise<string> =>
  defaultManager.signChallenge(challengeB64);
export const createReconnectRequest = (): Promise<{
  telemetryId: string;
  timestamp: number;
  signature: string;
}> => defaultManager.createReconnectRequest();
