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
    expect(res).toMatchObject({
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
      Buffer.from('02 0102 0304 0506 0708'.replaceAll(' ', ''), 'hex'),
    ) as unknown as { arrayTest: A };
    expect(res).toMatchObject({
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
      Buffer.from('02 0102 0304 0506 0708'.replaceAll(' ', ''), 'hex'),
    ) as unknown as A;
    console.log(res);
    console.log(JSON.stringify(res, null, 2));
  });
});
