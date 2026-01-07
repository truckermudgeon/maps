import { Parser } from 'binary-parser';

const p = () => new Parser();

type StructDef = Record<string, Base>;

class Base {
  readonly parser = p();
}

class Struct extends Base {
  constructor(_map: StructDef) {
    super();
  }
}

class Array extends Base {
  constructor(_type: unknown, _lengthField: unknown) {
    super();
  }
}

class Reserved extends Base {
  constructor(_type: unknown, _length = 1) {
    super();
  }
}

class VersionedStruct extends Base {
  constructor(
    _tagType: unknown,
    _headerAndTypes: { header: StructDef } & Record<number, StructDef>,
  ) {
    super();
  }
}

class Optional extends Base {
  constructor(_type: unknown, _testFn: (ctx: never) => boolean) {
    super();
  }
}

class DecodeStream {
  constructor(readonly buffer: Buffer) {}
}

export const float3 = new Base();
export const float4 = new Base();
export const paddedString = new Base();
export const token64 = new Base();
export const uint64String = new Base();
export const uint64le = new Base();

const uint16le = new Base();
const uint32le = new Base();
const floatle = new Base();
const uint8 = new Base();
const int16le = new Base();
const int32le = new Base();
const int8 = new Base();

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
