import { Parser } from 'binary-parser';
import type { BaseOf } from '../bridge';
import { r } from '../bridge';

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
    type S = BaseOf<typeof s>;

    const parser = new Parser();
    s.bind('struct', parser);
    const res = parser.parse(
      Buffer.from('0102 0304  0506 0708 01 0102'.replaceAll(' ', ''), 'hex'),
    ) as unknown as S;
    expect(res).toEqual({
      struct: {
        foo: 513,
        bar: 1027,
        nested: {
          buzz: 2055,
          fizz: 1541,
        },
        array: [{ foo: 513 }],
      },
    });
  });

  it('supports size-prefixed struct arrays', () => {
    const a = new r.Array(
      new r.Struct({
        foo: r.uint16le,
      }),
      r.uint8,
    );
    type A = BaseOf<typeof a>;

    const parser = new Parser();
    a.bind('arrayTest', parser);
    const res = parser.parse(
      Buffer.from('02 0102 0304'.replaceAll(' ', ''), 'hex'),
    ) as unknown as { arrayTest: A };
    expect(res).toEqual({
      arrayTest: [
        {
          foo: 513,
        },
        {
          foo: 1027,
        },
      ],
    });
  });

  it('supports size-prefixed primitive arrays', () => {
    const a = new r.Array(r.uint16le, r.uint8);
    type A = BaseOf<typeof a>;

    const parser = new Parser();
    a.bind('arrayTest', parser);
    const res = parser.parse(
      Buffer.from('02 0102 0304'.replaceAll(' ', ''), 'hex'),
    ) as unknown as A;
    expect(res).toEqual({
      arrayTest: [513, 1027],
    });
  });

  it('supports fixed-length struct arrays', () => {
    const a = new r.Array(
      new r.Struct({
        foo: r.uint16le,
      }),
      2,
    );
    type A = BaseOf<typeof a>;

    const parser = new Parser();
    a.bind('arrayTest', parser);
    const res = parser.parse(
      Buffer.from('0102 0304'.replaceAll(' ', ''), 'hex'),
    ) as unknown as { arrayTest: A };
    expect(res).toEqual({
      arrayTest: [
        {
          foo: 513,
        },
        {
          foo: 1027,
        },
      ],
    });
  });

  it('supports fixed-length primitive arrays', () => {
    const a = new r.Array(r.uint16le, 2);
    type A = BaseOf<typeof a>;

    const parser = new Parser();
    a.bind('arrayTest', parser);
    const res = parser.parse(
      Buffer.from('0102 0304'.replaceAll(' ', ''), 'hex'),
    ) as unknown as A;
    expect(res).toEqual({
      arrayTest: [513, 1027],
    });
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
    type S = BaseOf<typeof s>;

    const parser = new Parser();
    s.bind('struct', parser);
    const res = parser.parse(
      Buffer.from('0102 0304  0506 0708 01 0102'.replaceAll(' ', ''), 'hex'),
    ) as unknown as S;
    expect(res).toEqual({
      struct: {
        foo: 513,
        nested: {
          buzz: 2055,
          fizz: 1541,
        },
        array: [{ foo: 513 }],
      },
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

    const parser = new Parser();
    s.bind('struct', parser);

    expect(
      parser.parse(Buffer.from('0102 03'.replaceAll(' ', ''), 'hex')),
    ).toEqual({
      struct: {
        nodeUids: [2],
        radius: 3,
      },
    });

    expect(
      parser.parse(Buffer.from('020203 04'.replaceAll(' ', ''), 'hex')),
    ).toEqual({
      struct: {
        nodeUids: [2, 3],
        radius: undefined,
      },
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

    const parser = new Parser();
    s.bind('struct', parser);

    expect(
      parser.parse(Buffer.from('0102 03'.replaceAll(' ', ''), 'hex')),
    ).toEqual({
      struct: {
        nodeUids: [2],
        radius: {
          foo: 3,
        },
      },
    });

    expect(
      parser.parse(Buffer.from('020203 04'.replaceAll(' ', ''), 'hex')),
    ).toEqual({
      struct: {
        nodeUids: [2, 3],
        radius: undefined,
      },
    });
  });
});
