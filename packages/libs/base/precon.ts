import { assertExists } from './assert';

export class UnreachableError extends Error {
  constructor(x: never) {
    super('unreachable value ' + JSON.stringify(x));
  }
}

export class Preconditions {
  static checkArgument(condition: boolean, msg?: string): asserts condition {
    if (!condition) {
      throw new Error(msg);
    }
  }

  static checkState(condition: boolean, msg?: string): asserts condition {
    if (!condition) {
      throw new Error(msg);
    }
  }

  static checkExists<T>(x: T, msg?: string): NonNullable<T> {
    return assertExists(x, msg);
  }
}
