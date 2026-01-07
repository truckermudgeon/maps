import { Parser } from 'binary-parser';

type StructType<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K] extends Base<never>
    ? undefined
    : T[K] extends Base<infer U>
      ? U
      : T[K] extends () => infer V
        ? V
        : T[K];
};

type StructFields<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K] extends () => infer V
    ? (this: StructType<Omit<T, K>>) => V
    : T[K];
};

export type BaseOf<T> = T extends Base<infer U> ? U : never;

const p = () => new Parser();

abstract class Base<T> {
  readonly parser = p();

  decode(_stream: DecodeStream): T {
    throw new Error();
  }

  abstract bind(name: string, parser: Parser): Parser;
}

type NumberPrimitive =
  | 'uint8'
  | 'uint16le'
  | 'uint16be'
  | 'uint32le'
  | 'uint32be'
  | 'int8'
  | 'int16le'
  | 'int16be'
  | 'int32le'
  | 'int32be'
  | 'int64be'
  | 'int64le'
  | 'uint64be'
  | 'uint64le'
  | 'floatle'
  | 'floatbe'
  | 'doublele'
  | 'doublebe';

class NumberBase extends Base<number> {
  constructor(private readonly type: NumberPrimitive) {
    super();
  }

  override bind(name: string, parser: Parser): Parser {
    parser[this.type](name);
    return parser;
  }
}

class Struct<T extends Record<string, unknown>> extends Base<StructType<T>> {
  constructor(private readonly map: StructFields<T>) {
    super();
    for (const [key, val] of Object.entries(this.map)) {
      if (val instanceof Base) {
        val.bind(key, this.parser);
      } else {
        throw new Error('struct: encountered unexpected type');
      }
    }
  }

  override bind(name: string, parser: Parser): Parser {
    return parser.nest(name, { type: this.parser });
  }
}

type LengthArray<T, N, R extends T[] = []> = N extends number
  ? number extends N
    ? T[]
    : R['length'] extends N
      ? R
      : LengthArray<T, N, [T, ...R]>
  : T[];

type SizeFn = (ctx: unknown) => number;

class Array<T, N extends number | string | NumberBase | SizeFn> extends Base<
  LengthArray<BaseOf<T>, N>
> {
  private readonly uid = crypto.randomUUID().replaceAll('-', '').slice(0, 8);

  constructor(
    private readonly type: T,
    private readonly lengthField: N,
  ) {
    super();
    if (this.type instanceof Base && this.lengthField instanceof Base) {
      //
    } else {
      throw new Error('array: encountered unexpected type');
    }
  }

  override bind(_name: string, _parser: Parser): Parser {
    throw new Error('Method not implemented.');
    //    const countField = '_count' + this.uid;
    //    this.lengthField.bind(countField, parser);
    //    return parser.array(name, { type: this.type.parser, length: countField });
  }
}

class Reserved extends Base<never> {
  constructor(_type: unknown, _length = 1) {
    super();
  }

  override bind(_name: string, _parser: Parser): Parser {
    throw new Error('Method not implemented.');
  }
}

type VersionedStructEntry<H, T, X = keyof T> = X extends 'header'
  ? never
  : X extends keyof T
    ? { version: X } & H & T[X]
    : never;

class VersionedStruct<H, T> extends Base<
  { version: keyof T } & StructType<VersionedStructEntry<H, T>>
> {
  constructor(_tagType: unknown, _headerAndTypes: { header: H } & T) {
    super();
  }

  override bind(_name: string, _parser: Parser): Parser {
    throw new Error('Method not implemented.');
  }
}

class Optional<T> extends Base<T | undefined> {
  constructor(_type: unknown, _testFn: (ctx: never) => boolean) {
    super();
  }

  override bind(_name: string, _parser: Parser): Parser {
    throw new Error('Method not implemented.');
  }
}

class DecodeStream {
  constructor(readonly buffer: Buffer) {}
}

const floatle = new NumberBase('floatle');
const int16le = new NumberBase('int16le');
const int32le = new NumberBase('int32le');
const int8 = new NumberBase('int8');
const uint16le = new NumberBase('uint16le');
const uint32le = new NumberBase('uint32le');
const uint8 = new NumberBase('uint8');

export const r = {
  Struct,
  Array,
  Reserved,
  Optional,
  VersionedStruct,
  //
  DecodeStream,
  //
  uint16le,
  uint32le,
  floatle,
  uint8,
  int16le,
  int32le,
  int8,
};

export const float3 = new r.Array(floatle, 3);
export const float4 = new r.Array(floatle, 4);
/*
export const paddedString = new Base();
export const token64 = new Base();
export const uint64String = new Base();
export const uint64le = new Base();
*/
