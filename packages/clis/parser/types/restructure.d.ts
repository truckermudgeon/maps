// mostly from https://github.com/foliojs/restructure/issues/55
// trimmed down to include only types used in maps project, and declares Base
// as an interface instead of a class.

declare module 'restructure' {
  export class DecodeStream {
    pos: number;

    constructor(buffer: Buffer);
    readString(length: number, encoding = 'ascii'): Buffer;
    readBuffer(length: number): Buffer;
  }

  export interface Base<T> {
    fromBuffer(buffer: Buffer): T;
    decode(stream: r.DecodeStream): T;
    size(t: T): number;
  }

  export type BaseOf<T> = T extends Base<infer U> ? U : never;

  export type LengthArray<T, N, R extends T[] = []> = N extends number
    ? number extends N
      ? T[]
      : R['length'] extends N
        ? R
        : LengthArray<T, N, [T, ...R]>
    : T[];

  type SizeFn = (ctx: any) => number;

  // TODO: Fix array of structs with computed properties type
  export class Array<
    T,
    N extends number | string | NumberT | SizeFn,
  > extends Base<LengthArray<BaseOf<T>, N>> {
    type: T;
    length?: N;

    constructor(type: T, length?: N, lengthType?: 'count' | 'bytes');
    fromBuffer(buffer: Buffer): LengthArray<BaseOf<T>, N>;
    decode(stream: r.DecodeStream): LengthArray<BaseOf<T>, N>;
    size(): number;
  }

  export class Bitfield<
    K extends string,
    T extends Record<K, boolean>,
  > extends Base<T> {
    constructor(type: Base<number>, fields: K[]);
    fromBuffer(buffer: Buffer): T;
    decode(stream: r.DecodeStream): T;
    size(): number;
  }

  export class Enum<T extends readonly string[]> extends Base<
    T[number] | number
  > {
    constructor(type: Base<number>, options: T);
    fromBuffer(buffer: Buffer): T[number] | number;
    decode(stream: r.DecodeStream): T[number] | number;
    size(): number;
  }

  class NumberT implements Base<number> {
    fromBuffer(buffer: Buffer): number;
    decode(stream: r.DecodeStream): number;
    size(): number;
  }

  type PredicateFn = (ctx: any) => boolean;

  export class Optional<T> extends Base<T | undefined> {
    constructor(type: Base<T>, condition?: boolean | PredicateFn);
    fromBuffer(buffer: Buffer): T;
    decode(stream: r.DecodeStream): T;
    size(): number;
  }

  export class Pointer<T> extends Base<T> {
    constructor(pointer: NumberT, t: Base<T>);
    fromBuffer(buffer: Buffer): T;
    decode(stream: r.DecodeStream): T;
    size(): number;
  }

  export class Reserved extends Base<never> {
    constructor(t: Base<T>, length: number = 1);
    fromBuffer(buffer: Buffer): never;
    decode(stream: r.DecodeStream): never;
    size(): number;
  }

  class StringT extends Base<string> {
    constructor(length: number, encoding = 'ascii');
    fromBuffer(buffer: Buffer): string;
    decode(stream: r.DecodeStream): string;
    size(): number;
  }

  export type StructType<T extends Record<string, unknown>> = {
    [K in keyof T]: T[K] extends Base<never>
      ? undefined
      : T[K] extends Base<infer U>
        ? U
        : T[K] extends () => infer V
          ? V
          : T[K];
  };

  export type StructFields<T extends Record<string, unknown>> = {
    [K in keyof T]: T[K] extends () => infer V
      ? (this: StructType<Omit<T, K>>) => V
      : T[K];
  };

  export class Struct<T extends Record<string, unknown>> extends Base<
    StructType<T>
  > {
    fields: StructFields<T>;

    constructor(fields: StructFields<T>);
    fromBuffer(buffer: Buffer): StructType<T>;
    toBuffer(struct: StructType<T>): Uint8Array;
    decode(stream: r.DecodeStream): StructType<T>;
    size(): number;
  }

  type VersionedStructEntry<H, T, X = keyof T> = X extends 'header'
    ? never
    : X extends keyof T
      ? { version: X } & H & T[X]
      : never;

  export class VersionedStruct<H, T> extends Base<
    { version: keyof T } & StructType<VersionedStructEntry<H, T>>
  > {
    constructor(versionField: NumberT, fields: { header: H } & T);
    fromBuffer(
      buffer: Buffer,
    ): { version: keyof T } & StructType<VersionedStructEntry<H, T>>;
    decode(
      stream: r.DecodeStream,
    ): { version: keyof T } & StructType<VersionedStructEntry<H, T>>;
    size(): number;
  }

  export { StringT as String };
  export const uint8: NumberT;
  export const uint16le: NumberT;
  export const uint24le: NumberT;
  export const uint32le: NumberT;
  export const int8: NumberT;
  export const int16le: NumberT;
  export const int32le: NumberT;
  export const floatle: NumberT;
}
