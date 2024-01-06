export function areSetsEqual<T>(a: Set<T>, b: Set<T>) {
  if (a.size !== b.size) {
    return false;
  }
  for (const aa of a) {
    if (!b.has(aa)) {
      return false;
    }
  }
  return true;
}
