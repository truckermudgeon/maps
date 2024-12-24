import type { CstNode } from 'chevrotain';
import {
  CstParser,
  EMPTY_ALT,
  Lexer,
  createToken,
  generateCstDts,
} from 'chevrotain';
import type { SiiVisitor } from 'sii-visitor';

const SiiNunit = createToken({ name: 'SiiNunit', pattern: /SiiNunit/ });
const LCurly = createToken({ name: 'LCurly', pattern: /\{/ });
const RCurly = createToken({ name: 'RCurly', pattern: /}/ });
const LSquare = createToken({ name: 'LSquare', pattern: /\[/ });
const RSquare = createToken({ name: 'RSquare', pattern: /]/ });
const LParen = createToken({ name: 'LParen', pattern: /\(/ });
const RParen = createToken({ name: 'RParen', pattern: /\)/ });
const Comma = createToken({ name: 'Comma', pattern: /,/ });
const Colon = createToken({ name: 'Colon', pattern: /:/ });
const AtInclude = createToken({ name: 'AtInclude', pattern: /@include/ });
const Property = createToken({
  name: 'Property',
  // This is starting to get unwieldy :-/.
  // The negative lookahead for `x` is to ensure HexLiterals can be parsed.
  pattern: /([a-zA-Z0-9_.]+)|((0(?!x))?[1-9]+[a-z_.]+[a-z0-9_.]+)/,
});
const NilLiteral = createToken({
  name: 'Nil',
  pattern: /nil/,
});
const StringLiteral = createToken({
  name: 'String',
  // Can't simply use /"[^"]*"/, because we might have string literals with
  // escaped double-quotes, e.g.: "this is \"fine\"".
  pattern: /"(?:[^"\\]|\\.)*"/,
});
const HexLiteral = createToken({
  name: 'HexLiteral',
  pattern: /0x[0-9a-fA-F]+/,
});
const NumberLiteral = createToken({
  name: 'NumberLiteral',
  longer_alt: [HexLiteral, Property],
  pattern: /[-+]?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/,
});
const BinaryFloat = createToken({
  name: 'BinaryFloat',
  // Hexadecimal representation of IEEE 754 binary32 floats, big-endian.
  pattern: /&[0-9a-fA-F]{8}/,
});
const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});
const Comment = createToken({
  name: 'Comment',
  pattern: /(\/\/|#).*/,
  group: Lexer.SKIPPED,
});

const allTokens = [
  SiiNunit,
  LCurly,
  RCurly,
  LSquare,
  RSquare,
  LParen,
  RParen,
  Comma,
  Colon,
  AtInclude,
  NilLiteral,
  StringLiteral,
  NumberLiteral,
  BinaryFloat,
  HexLiteral,
  Property,
  WhiteSpace,
  Comment,
];

const SiiLexer = new Lexer(allTokens);

class SiiParser extends CstParser {
  readonly includeDirective = this.RULE('includeDirective', () => {
    this.CONSUME(AtInclude);
    this.CONSUME(StringLiteral);
  });
  readonly objectPropertyIndex = this.RULE('objectPropertyIndex', () => {
    this.CONSUME(LSquare);
    // TODO constrain to positive integers?
    this.OPTION(() => this.CONSUME(NumberLiteral));
    this.CONSUME(RSquare);
  });
  readonly numberTuple = this.RULE('numberTuple', () => {
    this.CONSUME(LParen);
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () =>
        this.OR([
          { ALT: () => this.CONSUME(NumberLiteral) },
          { ALT: () => this.CONSUME(BinaryFloat) },
        ]),
    });
    this.CONSUME(RParen);
  });
  readonly numberAuxTuple = this.RULE('numberAuxTuple', () => {
    this.CONSUME(LCurly);
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => this.CONSUME(NumberLiteral),
    });
    this.CONSUME(RCurly);
  });
  readonly objectPropertyValue = this.RULE('objectPropertyValue', () => {
    this.OR([
      { ALT: () => this.CONSUME(NilLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(BinaryFloat) },
      { ALT: () => this.CONSUME(HexLiteral) },
      { ALT: () => this.CONSUME(Property) },
      { ALT: () => this.SUBRULE(this.numberTuple) },
      { ALT: () => this.SUBRULE(this.numberAuxTuple) },
    ]);
  });
  readonly objectProperty = this.RULE('objectProperty', () => {
    this.CONSUME2(Property);
    this.OPTION(() => this.SUBRULE(this.objectPropertyIndex));
    this.CONSUME1(Colon);
    this.SUBRULE(this.objectPropertyValue);
  });
  readonly object = this.RULE('object', () => {
    this.CONSUME(Property);
    this.CONSUME(Colon);
    this.OR([
      { ALT: () => this.CONSUME1(Property) },
      // .mat files can have string literals here, e.g., "ui"
      { ALT: () => this.CONSUME(StringLiteral) },
    ]);
    this.CONSUME(LCurly);
    this.MANY(() => {
      this.OR1([
        { ALT: () => this.SUBRULE(this.includeDirective) },
        { ALT: () => this.SUBRULE(this.object) },
        { ALT: () => this.SUBRULE(this.objectProperty) },
      ]);
    });
    this.CONSUME(RCurly);
  });
  readonly wrappedSii = this.RULE('wrappedSii', () => {
    this.CONSUME(SiiNunit);
    this.CONSUME(LCurly);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.includeDirective) },
        { ALT: () => this.SUBRULE(this.object) },
      ]);
    });
    this.CONSUME(RCurly);
  });
  readonly unwrappedSii = this.RULE('unwrappedSii', () => {
    this.AT_LEAST_ONE(() => this.SUBRULE(this.object));
  });
  readonly sii = this.RULE('sii', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.wrappedSii) },
      { ALT: () => this.SUBRULE(this.unwrappedSii) },
      { ALT: () => EMPTY_ALT() },
    ]);
  });

  constructor() {
    // bump up maxLookahead to 4 to accommodate recursive object rule.
    super(allTokens, { maxLookahead: 4 });
    this.performSelfAnalysis();
  }
}

const parser = new SiiParser();
const baseVisitor = parser.getBaseCstVisitorConstructorWithDefaults();

// Workaround for TS2562: Base class expressions cannot reference class type parameters,
// when trying to do something like:
//
//   type SiiVisitorClass<T, U> = { new(...args: any[]): SiiVisitor<T, U> };
//   class V2<T, U> extends (parser.getBaseCstVisitorConstructorWithDefaults() as SiiVisitorClass<T, U>);
//
// https://github.com/Microsoft/TypeScript/issues/17829#issuecomment-323020591
export const getSiiVisitorClass = <IN>() => {
  // For now, don't support visit methods that return things.
  // Do this for convenience, so impls of VisitorClasses don't need to worry
  // about implementing all visitor methods.
  // https://chevrotain.io/docs/guide/concrete_syntax_tree.html#do-we-always-have-to-implement-all-the-visit-methods
  type SiiVisitorClass = new (...args: unknown[]) => SiiVisitor<IN, void>;
  return class extends (baseVisitor as SiiVisitorClass) {
    override visit(node: CstNode | CstNode[], input: IN) {
      super.visit(node, input);
    }
  };
};

// use this to regenerate types/sii-visitor.d.ts
export function generateVisitorDts(): string {
  const generatedFileWarning = `
// This file is generated by chevrotain. Do not edit it directly.
// To change syntax tree definitions, edit sii-parser.ts,
// then execute \`npm run gen:types -w packages/clis/parser\`.

`;
  return (
    generatedFileWarning +
    generateCstDts(parser.getGAstProductions(), {
      includeVisitorInterface: true,
      visitorInterfaceName: 'SiiVisitor',
    })
  );
}

export function parseSii(sii: string) {
  const lexResult = SiiLexer.tokenize(sii);
  parser.input = lexResult.tokens;
  const cst = parser.sii();
  return {
    cst,
    input: parser.input,
    ok: lexResult.errors.length === 0 && parser.errors.length === 0,
    lexErrors: lexResult.errors,
    parseErrors: parser.errors,
  };
}
