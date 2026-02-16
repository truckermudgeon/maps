import { Cacheable } from 'cacheable';
import type crypto from 'crypto';
import { EventEmitter } from 'events';
import type { TruckSimTelemetry } from '../../types';

export type KvKey<K extends keyof KvEntries> = string & K & { __brand: never };

interface KvSetEvent<K extends keyof KvEntries> {
  key: KvKey<K>;
  value: KvEntries[K];
  ttlMs?: number;
}

export interface ObservableKvStore {
  onSet<K extends keyof KvEntries>(
    cb: (event: KvSetEvent<K>) => void,
  ): () => void;
}

export const navigatorKeys = {
  challenge: (nonce: string) => `challenge:${nonce}` as KvKey<'challenge'>,
  pairing: (code: string) => `pairing:${code}` as KvKey<'pairing'>,
  publicKey: (telemetryId: string) =>
    `publicKey:${telemetryId}` as KvKey<'publicKey'>,

  telemetry: (telemetryId: string) =>
    `telemetry:${telemetryId}` as KvKey<'telemetry'>,

  viewerId: (id: string) => `viewerId:${id}` as KvKey<'viewerId'>,
};

export const rateLimitKeys = {
  wsUpgrade: (ip: string) => `rl:ws:upgrade:${ip}` as KvKey<'wsUpgrade'>,
  wsConnect: (ip: string) => `rl:ws:connect:${ip}` as KvKey<'wsConnect'>,
  // N.B.: limiting based on clientId, and not the containing sessionId, because
  //   1. sessionId is not currently part of Context
  //   2. concurrent ip limiting should handle the majority of cases where a
  //      session has too many clients.
  rpc: (clientId: string, path: string) =>
    `rl:rpc:${clientId}:${path}` as KvKey<'rpc'>,
};

interface KvEntries {
  // challenge nonce -> challenge object
  challenge: {
    publicKey: crypto.webcrypto.CryptoKey;
    nonce: string;
    expiresAt: number;
    used: boolean;
  };

  // pairing code -> telemetry id, redeemed
  pairing: {
    telemetryId: string;
    redeemed: boolean;
    cleanupOnRedemption?: true;
  };

  // telemetry id -> public key
  publicKey: crypto.webcrypto.CryptoKey;

  // telemetry id -> telemetry data
  telemetry: TruckSimTelemetry;

  // viewer id -> telemetry id
  viewerId: string;

  // rate limit keys
  wsUpgrade: number;
  wsConnect: number;
  rpc: number;
}

export interface KvStore extends ObservableKvStore {
  get<K extends keyof KvEntries>(
    key: KvKey<K>,
  ): Promise<KvEntries[K] | null | undefined>;
  set<K extends keyof KvEntries>(
    key: KvKey<K>,
    value: KvEntries[K],
    opts?: { ttlMs?: number },
  ): Promise<void>;

  has(key: KvKey<keyof KvEntries>): Promise<boolean>;
  delete(key: KvKey<keyof KvEntries>): Promise<void>;
  expire(key: KvKey<keyof KvEntries>, ttlSeconds: number): Promise<void>;

  // TODO how to make this so that keys specified can only refer to `number` values?
  incr(key: KvKey<keyof KvEntries>): Promise<number>;
  decr(key: KvKey<keyof KvEntries>): Promise<number>;
}

export function createCacheableKv(): KvStore {
  const cacheable = new Cacheable({ ttl: '1h' });
  const expirationTimerIds = new Map<string, ReturnType<typeof setTimeout>>();
  const events = new EventEmitter();

  return {
    get: key => cacheable.get(key),
    has: key => cacheable.has(key),

    set: async (key, value, opts) => {
      await cacheable.set(key, value, opts?.ttlMs);

      const timerId = expirationTimerIds.get(key);
      if (timerId) {
        expirationTimerIds.delete(key);
        clearTimeout(timerId);
      }

      return void events.emit('set', {
        key,
        value,
        ttlMs: opts?.ttlMs,
      });
    },

    onSet: <K extends keyof KvEntries>(cb: (event: KvSetEvent<K>) => void) => {
      events.on('set', cb);
      return () => events.off('set', cb);
    },

    delete: async key => {
      const timerId = expirationTimerIds.get(key);
      if (timerId) {
        expirationTimerIds.delete(key);
        clearTimeout(timerId);
      }

      await cacheable.delete(key);
    },

    incr: async key => {
      const current = await cacheable.get<number>(key);
      const next = (current ?? 0) + 1;

      await cacheable.set(key, next);

      return next;
    },

    decr: async key => {
      const current = await cacheable.get<number>(key);
      const next = Math.max(0, (current ?? 0) - 1);

      await cacheable.set(key, next);

      return next;
    },

    expire: async (key, ttlSeconds) => {
      if (expirationTimerIds.has(key)) {
        // emulate Redis' EXPIRE NX behavior, where expiry is set only if key
        // has no expiry.
        return;
      }

      const value = await cacheable.get(key);
      if (value == null) {
        return;
      }

      const timerId = setTimeout(() => {
        void cacheable.delete(key);
        expirationTimerIds.delete(key);
      }, ttlSeconds * 1000);
      expirationTimerIds.set(key, timerId);
    },
  };
}
