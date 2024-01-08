import type { Base } from 'restructure';
import * as r from 'restructure';

// `restructure` parsing helpers

export const float3 = new r.Array(r.floatle, 3);
export const float4 = new r.Array(r.floatle, 4);

// add this field to the end of a struct def to output parsed struct
export const debugStruct = new r.Array(r.uint8, function (parent: unknown) {
  console.log(parent);
  return 0;
});

class Uint64 implements Base<bigint> {
  fromBuffer(): bigint {
    throw new Error('Method not implemented.');
  }

  decode(stream: r.DecodeStream): bigint {
    return stream.readBuffer(8).readBigUInt64LE();
  }

  size() {
    return 8;
  }
}

export const uint64le = new Uint64();

class Token implements Base<string> {
  fromBuffer(): string {
    throw new Error('Method not implemented.');
  }

  decode(stream: r.DecodeStream): string {
    return Token.tokenToString(stream.readBuffer(8).readBigUInt64LE());
  }

  size() {
    return 8;
  }

  private static readonly tokenLetters = [
    ...'\x000123456789abcdefghijklmnopqrstuvwxyz_',
  ];

  // ported from https://github.com/dariowouters/ts-map/blob/0163e95d652f35953e38695084abd6d0cb071446/docs/structures/base/875/functions.1sc
  private static tokenToString(n: bigint): string {
    let str = '';
    do {
      str += Token.tokenLetters[Number(n % 38n)];
      n /= 38n;
    } while (n !== 0n);
    return str.replaceAll('\x00', '');
  }
}

export const token64 = new Token();

class PaddedString implements Base<string> {
  fromBuffer(): string {
    throw new Error('Method not implemented.');
  }

  decode(stream: r.DecodeStream): string {
    const length = stream.readBuffer(4).readUint32LE();
    if (length === 0) {
      return '';
    }
    stream.readBuffer(4); // skip padding
    return stream.readString(length).toString();
  }

  size(str: string) {
    return str.length ? 8 + str.length : 4;
  }
}

export const paddedString = new PaddedString();

class Uint64String implements Base<string> {
  fromBuffer(): string {
    throw new Error('Method not implemented.');
  }

  decode(stream: r.DecodeStream): string {
    const length = stream.readBuffer(8).readBigUInt64LE();
    if (length === 0n) {
      return '';
    }
    return stream.readString(Number(length)).toString();
  }

  size(str: string) {
    return 8 + str.length;
  }
}

export const uint64String = new Uint64String();
