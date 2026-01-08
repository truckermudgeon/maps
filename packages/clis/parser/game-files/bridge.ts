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
  readonly dummyT: T = undefined as T;

  abstract bind(name: string, parser: Parser): Parser;

  decode(stream: DecodeStream): T {
    const parser = new Parser();
    this.bind('root', parser);
    parser.saveOffset('_privateOffset').seek(function (
      this: Record<string, unknown>,
    ) {
      stream.pos = this['_privateOffset'] as number;
      return 0;
    });

    const res = parser.parse(stream.buffer) as unknown as {
      root: T;
    };
    return res.root;
  }
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

class NumberBase<T extends number | bigint = number> extends Base<T> {
  constructor(readonly primitiveType: NumberPrimitive) {
    super();
  }

  override bind(name: string, parser: Parser): Parser {
    parser[this.primitiveType](name);
    return parser;
  }
}

class Struct<T extends Record<string, unknown>> extends Base<StructType<T>> {
  constructor(private readonly map: StructFields<T>) {
    super();
  }

  override bind(name: string, parser: Parser): Parser {
    const sParser = new Parser();
    for (const [key, val] of Object.entries(this.map)) {
      if (val instanceof Base) {
        val.bind(key, sParser);
      } else {
        throw new Error('struct: encountered unexpected type');
      }
    }
    return parser.nest(name, { type: sParser });
  }
}

type LengthArray<T, N, R extends T[] = []> = N extends number
  ? number extends N
    ? T[]
    : R['length'] extends N
      ? R
      : LengthArray<T, N, [T, ...R]>
  : T[];

type SizeFn<P> = (ctx: P) => number;

class Array<
  T,
  N extends NumberBase | number | string | SizeFn<P>,
  P = never,
> extends Base<LengthArray<BaseOf<T>, N>> {
  private readonly uid = crypto.randomUUID().replaceAll('-', '').slice(0, 8);

  constructor(
    private readonly type: T,
    private readonly lengthField: N,
  ) {
    super();
    if (!(this.type instanceof Base)) {
      throw new Error('array: encountered unexpected type');
    }
  }

  override bind(name: string, parser: Parser): Parser {
    const itemType = this.type as unknown as Base<T>;
    let type;
    if (itemType instanceof NumberBase) {
      type = itemType.primitiveType;
    } else {
      type = new Parser();
      itemType.bind(null as unknown as string, type);
    }

    if (this.lengthField instanceof NumberBase) {
      const countField = '_count' + this.uid;
      this.lengthField.bind(countField, parser);
      return parser.array(name, {
        type,
        length: countField,
        formatter: function (item: unknown) {
          //delete (this as Record<string, unknown>)[countField];
          return item;
        },
      });
    } else if (this.lengthField instanceof Function) {
      const lengthFn: (p: P) => number = this.lengthField;
      return parser.array(name, {
        type,
        length: function () {
          return lengthFn(this as unknown as P);
        },
      });
    } else {
      return parser.array(name, {
        type,
        length: this.lengthField,
      });
    }
  }
}

class Reserved extends Base<never> {
  constructor(
    private readonly type: NumberBase,
    private readonly count = 1,
  ) {
    super();
  }

  override bind(_name: string, parser: Parser): Parser {
    return parser.array('_skip', {
      type: this.type.primitiveType,
      length: this.count,
      formatter: () => undefined,
    });
  }
}

class Optional<T, P> extends Base<T | undefined> {
  constructor(
    private readonly type: Base<T>,
    private readonly testFn: (parent: P) => boolean,
  ) {
    super();
  }

  override bind(name: string, parser: Parser): Parser {
    const itemType = this.type as unknown as Base<T>;
    let type;
    if (itemType instanceof NumberBase) {
      type = itemType.primitiveType;
    } else {
      type = new Parser();
      itemType.bind(null as unknown as string, type);
    }

    const testFn = this.testFn;
    return parser.array(name, {
      type,
      length: function () {
        return testFn(this as unknown as P) ? 1 : 0;
      },
      formatter: (arr: BaseOf<typeof this.type>[]) => arr[0],
    });
  }
}

type VersionedStructEntry<H, T, X = keyof T> = X extends 'header'
  ? never
  : X extends keyof T
    ? { version: X } & H & T[X]
    : never;

class VersionedStruct<
  H extends StructFields<Record<string, unknown>>,
  T,
> extends Base<{ version: keyof T } & StructType<VersionedStructEntry<H, T>>> {
  private readonly headerStruct: Struct<Record<string, unknown>>;
  private readonly types: Omit<{ header: H } & T, 'header'>;

  constructor(
    private readonly tagType: NumberBase,
    headerAndTypes: { header: H } & T,
  ) {
    super();
    const { header, ...types } = headerAndTypes;
    this.types = types;
    this.headerStruct = new Struct(header as Record<string, unknown>);
  }

  override bind(name: string, parser: Parser): Parser {
    const vsParser = new Parser();
    this.tagType.bind('version', vsParser);
    this.headerStruct.bind(null as unknown as string, vsParser);

    const parserMap: Partial<Record<keyof T, Parser>> = {};
    for (const key of Object.keys(this.types)) {
      const structDef = this.types[key as keyof typeof this.types];
      const struct = new Struct(
        structDef as StructFields<Record<string, unknown>>,
      );
      const structParser = new Parser();
      struct.bind(null as unknown as string, structParser);
      parserMap[key as keyof T] = structParser;
    }

    vsParser.choice(null as unknown as string, {
      tag: 'version',
      choices: parserMap,
    });

    return parser.nest(name, { type: vsParser });
  }
}

class DecodeStream {
  pos = 0;

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

class PaddedString extends Base<string> {
  private readonly uid = crypto.randomUUID().replaceAll('-', '').slice(0, 8);

  constructor() {
    super();
  }

  bind(name: string, parser: Parser): Parser {
    const sizeField = '_size' + this.uid;
    return parser.uint32le(sizeField).wrapped(null as unknown as string, {
      length: function () {
        const thisRecord = this as Record<string, unknown>;
        const length = thisRecord[sizeField] as number;
        //delete thisRecord[sizeField];
        return length === 0 ? 0 : length + 4;
      },
      wrapper: buffer => buffer.subarray(4),
      type: new Parser().string(name, {
        greedy: true,
        zeroTerminated: false,
        encoding: 'ascii',
      }),
    });
  }
}

class Uint64String extends Base<string> {
  private readonly uid = crypto.randomUUID().replaceAll('-', '').slice(0, 8);

  constructor() {
    super();
  }

  bind(name: string, parser: Parser): Parser {
    const sizeField = '_size' + this.uid;
    return parser.uint64le(sizeField).wrapped(null as unknown as string, {
      length: function () {
        const thisRecord = this as Record<string, unknown>;
        const length = Number(thisRecord[sizeField]);
        //delete thisRecord[sizeField];
        return length;
      },
      wrapper: buffer => buffer,
      type: new Parser().string(name, {
        greedy: true,
        zeroTerminated: false,
        encoding: 'ascii',
      }),
    });
  }
}

class Token extends Base<string> {
  private static readonly tokenLetters = [
    ...'\x000123456789abcdefghijklmnopqrstuvwxyz_',
  ];

  bind(name: string, parser: Parser): Parser {
    return parser.uint64le(name, {
      formatter: function (n: bigint) {
        let str = '';
        do {
          str += Token.tokenLetters[Number(n % 38n)];
          n /= 38n;
        } while (n !== 0n);
        return str.replaceAll('\x00', '');
      },
    });
  }
}

export const float3 = new r.Array(floatle, 3);
export const float4 = new r.Array(floatle, 4);
export const paddedString = new PaddedString();
export const token64 = new Token();
export const uint64String = new Uint64String();
export const uint64le = new NumberBase<bigint>('uint64le');
