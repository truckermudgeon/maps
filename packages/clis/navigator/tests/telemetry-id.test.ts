import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type TelemetryIdManager,
  makeTelemetryIdManager,
} from '../telemetry-id';

describe('challenge handshake', () => {
  // Bind a fresh manager to a per-run temp dir so the test never touches the
  // real ~/.config/trucksim-navigator. Earlier versions imported the
  // default-bound functions directly and stomped on the user's actual
  // telemetry-id.txt and key files.
  let tempDir: string;
  let mgr: TelemetryIdManager;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'trucksim-navigator-test-'),
    );
    mgr = makeTelemetryIdManager(tempDir);
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('verifies identity on first contact', async () => {
    // client
    const publicKey = await mgr.getPublicKey();

    // client -> issueChallenge(publicKey) -> server

    // server
    // server stores public key
    const clientPublicKey = await crypto.subtle.importKey(
      'jwk',
      publicKey,
      'Ed25519',
      true,
      ['verify'],
    );
    const nonce = crypto.randomBytes(32);
    const challenge = {
      nonce: nonce.toString('base64url'),
      expiresAt: Date.now() + 30_000,
      used: false,
    };
    const challengeFromServer = {
      challenge: nonce.toString('base64url'),
    };
    console.log('challengeFromServer', challengeFromServer);

    // client <- challengeResponse <- server

    // client
    const signature = await mgr.signChallenge(challengeFromServer.challenge);
    const challengeResponse = {
      challenge: challengeFromServer.challenge,
      signature,
    };
    console.log('challengeResponse', challengeResponse);

    // client -> signature -> server

    // server
    expect(challengeResponse.challenge).toEqual(challenge.nonce);
    expect(Date.now()).toBeLessThan(challenge.expiresAt);
    expect(challenge.used).toBe(false);

    challenge.used = true;
    const isValid = await crypto.subtle.verify(
      'Ed25519',
      clientPublicKey,
      Buffer.from(challengeResponse.signature, 'base64url'),
      nonce,
    );
    expect(isValid).toBe(true);

    // server generates telemetryId, returns it.
    // server associates telemetryId with public key.

    // client stores telemetryId (sends it as part of future reconnect requests).
    mgr.storeTelemetryId(crypto.randomUUID());

    // client is PROVISIONAL.
    // client requests pairing code. displays to user.

    // client subscribes to waitForViewer before sending telemetry

    // user redeems code. client is AUTHENTICATED
  });

  it('verifies identity on reconnect', async () => {
    // client
    const reconnectRequest = await mgr.createReconnectRequest();
    const { telemetryId, timestamp, signature } = reconnectRequest;

    // server
    const now = Date.now();
    expect(now - 30_000).toBeLessThan(timestamp);
    expect(timestamp).toBeLessThanOrEqual(now);

    // previously stored
    const clientPublicKey = await crypto.subtle.importKey(
      'jwk',
      await mgr.getPublicKey(),
      'Ed25519',
      true,
      ['verify'],
    );
    const clientTelemetryId = mgr.getTelemetryId();
    // server verifies telemetryId is associated with public key
    expect(clientTelemetryId).toEqual(telemetryId);
    // (if fails, then client goes through challenge flow again)

    const isValid = await crypto.subtle.verify(
      'Ed25519',
      clientPublicKey,
      Buffer.from(signature, 'base64url'),
      Buffer.from(
        JSON.stringify({ telemetryId: clientTelemetryId, timestamp }),
        'base64url',
      ),
    );
    expect(isValid).toBe(true);

    // client is AUTHENTICATED
    // client subscribes to waitForViewer before sending telemetry
  });
});
