export function assertExists<T>(x: T, msg?: string): NonNullable<T> {
  if (x == null) {
    throw new Error(msg);
  }
  return x;
}

export function assert(condition: boolean, msg?: string): condition is true {
  if (!condition) {
    throw new Error(`assertion failed: ${msg}`);
  }
  return condition;
}
