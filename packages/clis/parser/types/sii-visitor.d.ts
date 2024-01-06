import type { CstNode, ICstVisitor, IToken } from 'chevrotain';

export interface IncludeDirectiveCstNode extends CstNode {
  name: 'includeDirective';
  children: IncludeDirectiveCstChildren;
}

export type IncludeDirectiveCstChildren = {
  AtInclude: IToken[];
  String: IToken[];
};

export interface ObjectPropertyIndexCstNode extends CstNode {
  name: 'objectPropertyIndex';
  children: ObjectPropertyIndexCstChildren;
}

export type ObjectPropertyIndexCstChildren = {
  LSquare: IToken[];
  NumberLiteral?: IToken[];
  RSquare: IToken[];
};

export interface NumberTupleCstNode extends CstNode {
  name: 'numberTuple';
  children: NumberTupleCstChildren;
}

export type NumberTupleCstChildren = {
  LParen: IToken[];
  NumberLiteral: IToken[];
  Comma?: IToken[];
  RParen: IToken[];
};

export interface ObjectPropertyValueCstNode extends CstNode {
  name: 'objectPropertyValue';
  children: ObjectPropertyValueCstChildren;
}

export type ObjectPropertyValueCstChildren = {
  String?: IToken[];
  NumberLiteral?: IToken[];
  HexLiteral?: IToken[];
  Property?: IToken[];
  numberTuple?: NumberTupleCstNode[];
};

export interface ObjectPropertyCstNode extends CstNode {
  name: 'objectProperty';
  children: ObjectPropertyCstChildren;
}

export type ObjectPropertyCstChildren = {
  Property: IToken[];
  objectPropertyIndex?: ObjectPropertyIndexCstNode[];
  Colon: IToken[];
  objectPropertyValue: ObjectPropertyValueCstNode[];
};

export interface ObjectCstNode extends CstNode {
  name: 'object';
  children: ObjectCstChildren;
}

export type ObjectCstChildren = {
  Property: IToken[];
  Colon: IToken[];
  String?: IToken[];
  LCurly: IToken[];
  includeDirective?: IncludeDirectiveCstNode[];
  object?: ObjectCstNode[];
  objectProperty?: ObjectPropertyCstNode[];
  RCurly: IToken[];
};

export interface WrappedSiiCstNode extends CstNode {
  name: 'wrappedSii';
  children: WrappedSiiCstChildren;
}

export type WrappedSiiCstChildren = {
  SiiNunit: IToken[];
  LCurly: IToken[];
  includeDirective?: IncludeDirectiveCstNode[];
  object?: ObjectCstNode[];
  RCurly: IToken[];
};

export interface UnwrappedSiiCstNode extends CstNode {
  name: 'unwrappedSii';
  children: UnwrappedSiiCstChildren;
}

export type UnwrappedSiiCstChildren = {
  object: ObjectCstNode[];
};

export interface SiiCstNode extends CstNode {
  name: 'sii';
  children: SiiCstChildren;
}

export type SiiCstChildren = {
  wrappedSii?: WrappedSiiCstNode[];
  unwrappedSii?: UnwrappedSiiCstNode[];
};

export interface SiiVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  includeDirective(children: IncludeDirectiveCstChildren, param?: IN): OUT;

  objectPropertyIndex(
    children: ObjectPropertyIndexCstChildren,
    param?: IN,
  ): OUT;

  numberTuple(children: NumberTupleCstChildren, param?: IN): OUT;

  objectPropertyValue(
    children: ObjectPropertyValueCstChildren,
    param?: IN,
  ): OUT;

  objectProperty(children: ObjectPropertyCstChildren, param?: IN): OUT;

  object(children: ObjectCstChildren, param?: IN): OUT;

  wrappedSii(children: WrappedSiiCstChildren, param?: IN): OUT;

  unwrappedSii(children: UnwrappedSiiCstChildren, param?: IN): OUT;

  sii(children: SiiCstChildren, param?: IN): OUT;
}
