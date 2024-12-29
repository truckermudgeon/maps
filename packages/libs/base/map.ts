// From https://docs.oracle.com/javase/8/docs/api/java/util/Map.html#putIfAbsent-K-V-
export function putIfAbsent<K, V>(key: K, defValue: V, map: Map<K, V>) {
  let v = map.get(key);
  if (v == null) {
    v = defValue;
    map.set(key, v);
  }
  return v;
}

export function mapValues<K, V, U>(
  map: ReadonlyMap<K, V>,
  m: (v: V) => U,
): Map<K, U> {
  return new Map([...map.entries()].map(([k, v]) => [k, m(v)]));
}
