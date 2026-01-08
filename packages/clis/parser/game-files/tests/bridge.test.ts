import { paddedString, r, token64, uint64String } from '../bridge';

const bufferFromHex = (hexString: string) =>
  Buffer.from(hexString.replaceAll(' ', ''), 'hex');

describe('parser bridge', () => {
  it('supports structs', () => {
    const s = new r.Struct({
      foo: r.uint16le,
      bar: r.uint16le,
      nested: new r.Struct({
        fizz: r.uint16le,
        buzz: r.uint16le,
      }),
      array: new r.Array(
        new r.Struct({
          foo: r.uint16le,
        }),
        r.uint8,
      ),
    });

    const res = s.decode(
      new r.DecodeStream(bufferFromHex('0102 0304  0506 0708 01 0102')),
    );

    expect(res).toEqual({
      foo: 513,
      bar: 1027,
      nested: {
        buzz: 2055,
        fizz: 1541,
      },
      array: [{ foo: 513 }],
    });
  });

  it('supports size-prefixed struct arrays', () => {
    const a = new r.Array(
      new r.Struct({
        foo: r.uint16le,
      }),
      r.uint8,
    );

    const res = a.decode(new r.DecodeStream(bufferFromHex('02 0102 0304')));

    expect(res).toEqual([
      {
        foo: 513,
      },
      {
        foo: 1027,
      },
    ]);
  });

  it('supports size-prefixed primitive arrays', () => {
    const a = new r.Array(r.uint16le, r.uint8);
    const res = a.decode(new r.DecodeStream(bufferFromHex('02 0102 0304')));
    expect(res).toEqual([513, 1027]);
  });

  it('supports fixed-length struct arrays', () => {
    const a = new r.Array(
      new r.Struct({
        foo: r.uint16le,
      }),
      2,
    );

    const res = a.decode(new r.DecodeStream(bufferFromHex('0102 0304')));

    expect(res).toEqual([
      {
        foo: 513,
      },
      {
        foo: 1027,
      },
    ]);
  });

  it('supports fixed-length primitive arrays', () => {
    const a = new r.Array(r.uint16le, 2);
    const res = a.decode(new r.DecodeStream(bufferFromHex('0102 0304')));
    expect(res).toEqual([513, 1027]);
  });

  it('supports reserved fields', () => {
    const s = new r.Struct({
      foo: r.uint16le,
      bar: new r.Reserved(r.uint8, 2),
      nested: new r.Struct({
        fizz: r.uint16le,
        buzz: r.uint16le,
      }),
      array: new r.Array(
        new r.Struct({
          foo: r.uint16le,
        }),
        r.uint8,
      ),
    });

    const res = s.decode(
      new r.DecodeStream(bufferFromHex('0102 0304  0506 0708 01 0102')),
    );

    expect(res).toEqual({
      foo: 513,
      nested: {
        buzz: 2055,
        fizz: 1541,
      },
      array: [{ foo: 513 }],
    });
  });

  it('supports optional primitives', () => {
    const s = new r.Struct({
      nodeUids: new r.Array(r.uint8, r.uint8),
      radius: new r.Optional(
        r.uint8,
        (parent: { nodeUids: unknown[] }) => parent.nodeUids.length === 1,
      ),
    });

    const res1 = s.decode(new r.DecodeStream(bufferFromHex('0102 03')));
    expect(res1).toEqual({
      nodeUids: [2],
      radius: 3,
    });

    const res2 = s.decode(new r.DecodeStream(bufferFromHex('020203 04')));
    expect(res2).toEqual({
      nodeUids: [2, 3],
      radius: undefined,
    });
  });

  it('supports optional structs', () => {
    const s = new r.Struct({
      nodeUids: new r.Array(r.uint8, r.uint8),
      radius: new r.Optional(
        new r.Struct({
          foo: r.uint8,
        }),
        (parent: { nodeUids: unknown[] }) => parent.nodeUids.length === 1,
      ),
    });

    const res1 = s.decode(new r.DecodeStream(bufferFromHex('0102 03')));
    expect(res1).toEqual({
      nodeUids: [2],
      radius: { foo: 3 },
    });

    const res2 = s.decode(new r.DecodeStream(bufferFromHex('020203 04')));
    expect(res2).toEqual({
      nodeUids: [2, 3],
      radius: undefined,
    });
  });

  it('supports padded strings', () => {
    const s = new r.Struct({
      foo: paddedString,
    });

    const res1 = s.decode(
      new r.DecodeStream(bufferFromHex('0500 0000  0000 0000 68656c6c6f ffff')),
    );
    expect(res1).toEqual({ foo: 'hello' });

    const res2 = paddedString.decode(
      new r.DecodeStream(bufferFromHex('0000 0000 ffff')),
    );
    expect(res2).toEqual('');
  });

  it('supports uint64 strings', () => {
    const s = new r.Struct({
      foo: uint64String,
    });

    const res1 = s.decode(
      new r.DecodeStream(bufferFromHex('0500 0000  0000 0000 68656c6c6f ffff')),
    );
    expect(res1).toEqual({ foo: 'hello' });

    const res2 = paddedString.decode(
      new r.DecodeStream(bufferFromHex('0000 0000 0000 0000 ffff')),
    );
    expect(res2).toEqual('');
  });

  it('supports tokens', () => {
    const s = new r.Struct({
      foo: token64,
    });

    const res = s.decode(
      new r.DecodeStream(bufferFromHex('6865 6c6c 6fff 0000')),
    );
    expect(res).toEqual({ foo: '5ccrrzolp0' });
  });

  it('supports versioned structs', () => {
    const s = new r.VersionedStruct(r.uint8, {
      header: {
        foo: r.int8,
        bar: r.int8,
      },
      1: {
        one: r.int8,
      },
      2: {
        two: r.int8,
        twoAgain: r.int8,
      },
    });

    const res1 = s.decode(new r.DecodeStream(bufferFromHex('01 0102 0b')));
    console.log(res1);
    expect(res1).toEqual({ version: 1, foo: 1, bar: 2, one: 11 });

    const res2 = s.decode(new r.DecodeStream(bufferFromHex('02 0102 1516')));
    console.log(res2);
    expect(res2).toEqual({ version: 2, foo: 1, bar: 2, two: 21, twoAgain: 22 });
  });
});
