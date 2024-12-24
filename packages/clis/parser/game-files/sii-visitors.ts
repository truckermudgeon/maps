import { assertExists } from '@truckermudgeon/base/assert';
import { Preconditions } from '@truckermudgeon/base/precon';
import type { CstNode } from 'chevrotain';
import type {
  IncludeDirectiveCstChildren,
  ObjectCstChildren,
  ObjectPropertyValueCstChildren,
} from 'sii-visitor';
import { logger } from '../logger';
import { getSiiVisitorClass } from './sii-parser';

class JsonConverterVisitor extends getSiiVisitorClass<
  Record<string, unknown>
>() {
  constructor() {
    super();
    this.validateVisitor();
  }

  convert(root: CstNode): Record<string, unknown> {
    const json = {};
    this.visit(root, json);
    return json;
  }

  override object(children: ObjectCstChildren, json: Record<string, unknown>) {
    const rootKey = snakeToCamel(children.Property[0].image);
    // don't camel-ify child keys; they seem to be significant
    // e.g., cityData.country references countryData keys
    const childKey = (
      children.Property[1] || assertExists(children.String)[0]
    ).image.replaceAll(/^"|"$/g, '');

    if (!Object.prototype.hasOwnProperty.call(json, rootKey)) {
      json[rootKey] = {};
    }
    const root = json[rootKey] as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(root, childKey)) {
      root[childKey] = {};
    }

    const obj = root[childKey] as Record<string, unknown>;
    if (children.object) {
      this.visit(children.object, obj);
    }
    if (children.objectProperty) {
      for (const { children: p } of children.objectProperty) {
        const propKey = snakeToCamel(p.Property[0].image);
        // Note: this doesn't validate fixed-length array declarations, e.g.:
        //   some_array: 2
        //   some_array[0]: foo
        //   some_array[1]: bar
        if (p.objectPropertyIndex) {
          let arr = obj[propKey] as unknown[];
          if (!Array.isArray(arr)) {
            arr = [];
            obj[propKey] = arr;
          }
          const tempWrapper = { value: undefined };
          this.visit(p.objectPropertyValue, tempWrapper);
          arr.push(assertExists(tempWrapper.value));
        } else {
          const tempWrapper = { value: undefined };
          this.visit(p.objectPropertyValue, tempWrapper);
          obj[propKey] = tempWrapper.value;
        }
      }
    }
  }

  override objectPropertyValue(
    children: ObjectPropertyValueCstChildren,
    json: { value: unknown },
  ): void {
    if (children.Nil) {
      json.value = undefined;
    } else if (children.String) {
      json.value = quotedStringToString(children.String[0].image);
    } else if (children.NumberLiteral) {
      json.value = stringToNumber(children.NumberLiteral[0].image);
      if (
        (json.value as number) > Number.MAX_SAFE_INTEGER &&
        /^\d+$/.test(children.NumberLiteral[0].image)
      ) {
        json.value = BigInt(children.NumberLiteral[0].image);
      }
    } else if (children.BinaryFloat) {
      json.value = stringToFloat(children.BinaryFloat[0].image);
    } else if (children.HexLiteral) {
      const bigInt = BigInt(children.HexLiteral[0].image);
      json.value = bigInt <= Number.MAX_SAFE_INTEGER ? Number(bigInt) : bigInt;
    } else if (children.Property) {
      json.value = children.Property[0].image;
    } else if (children.numberTuple) {
      const arr: NumberTupleChild[] = [];
      children.numberTuple[0].children.NumberLiteral?.forEach(l =>
        arr.push({ value: stringToNumber(l.image), offset: l.startOffset }),
      );
      children.numberTuple[0].children.BinaryFloat?.forEach(l =>
        arr.push({ value: stringToFloat(l.image), offset: l.startOffset }),
      );
      // Regular numbers and binary floats may be mixed in any order.
      // Sort by the offset to get the original order from the SII file.
      json.value = arr.sort((a, b) => a.offset - b.offset).map(x => x.value);
    } else if (children.numberAuxTuple) {
      json.value = children.numberAuxTuple[0].children.NumberLiteral.map(l =>
        stringToNumber(l.image),
      );
    } else {
      throw new Error(
        'unexpected property value type:\n' + JSON.stringify(children, null, 2),
      );
    }
  }

  override includeDirective(children: IncludeDirectiveCstChildren) {
    logger.warn('ignoring @include directive', children.String[0].image);
  }
}

interface NumberTupleChild {
  value: number | null;
  offset: number;
}

class IncludeDirectiveCollector extends getSiiVisitorClass<string[]>() {
  constructor() {
    super();
    this.validateVisitor();
  }

  collect(root: CstNode, basePath: string) {
    const suis: string[] = [];
    this.visit(root, suis);
    return suis.map(s => (s.startsWith('/') ? s.slice(1) : `${basePath}/${s}`));
  }

  override includeDirective(
    children: IncludeDirectiveCstChildren,
    acc: string[],
  ) {
    acc.push(quotedStringToString(children.String[0].image));
  }

  override object() {
    throw new Error('Non-@include directive encountered.');
  }
}

export const jsonConverter = new JsonConverterVisitor();
export const includeDirectiveCollector = new IncludeDirectiveCollector();

function snakeToCamel(str: string) {
  return str.replace(/(_[a-z0-9])/g, g => g.substring(1).toUpperCase());
}

function quotedStringToString(str: string) {
  Preconditions.checkArgument(str.startsWith('"') && str.endsWith('"'));
  return str.slice(1, -1).replace(/\\"/g, '"');
}

function stringToNumber(str: string) {
  const num = Number(str);
  if (isNaN(num)) {
    throw new Error('could not parse number: ' + str);
  }
  return num;
}

function stringToFloat(str: string): number | null {
  const binaryInt = parseInt(str.substring(1), 16);
  if (isNaN(binaryInt)) {
    throw new Error('could not parse binary float: ' + str);
  }
  if (binaryInt == 0x7f7fffff) {
    // binary32 float max finite value, used as a "no data" marker
    return null;
  }
  const data = new DataView(new ArrayBuffer(4));
  data.setUint32(0, binaryInt);
  return data.getFloat32(0);
}
