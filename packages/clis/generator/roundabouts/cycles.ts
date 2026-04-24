import type { AdjacencyList } from './graph';

interface Frame {
  v: string;
  i: number;
  neighbors: string[];
  foundCycle: boolean;
}

export function findAllSimpleCycles(
  graph: AdjacencyList,
  minLen = 4,
  maxLen = 15,
): string[][] {
  const nodes = Array.from(graph.keys()).sort(); // stable ordering
  const indexMap = new Map(nodes.map((n, i) => [n, i]));

  const result: string[][] = [];

  const blocked = new Set<string>();
  const B = new Map<string, Set<string>>();
  for (const v of nodes) B.set(v, new Set());

  const path: string[] = [];

  function unblock(start: string) {
    const stack = [start];
    while (stack.length) {
      const v = stack.pop()!;
      if (blocked.has(v)) {
        blocked.delete(v);
        for (const w of B.get(v)!) {
          stack.push(w);
        }
        B.get(v)!.clear();
      }
    }
  }

  for (let sIdx = 0; sIdx < nodes.length; sIdx++) {
    const s = nodes[sIdx];

    // Build subgraph with nodes >= s
    const subgraph = new Map<string, string[]>();
    for (let i = sIdx; i < nodes.length; i++) {
      const v = nodes[i];
      const filtered = (graph.get(v) ?? new Set())
        .values()
        .toArray()
        .filter(w => indexMap.get(w)! >= sIdx);
      subgraph.set(v, filtered);
    }

    // Reset state
    blocked.clear();
    for (const v of nodes) B.get(v)!.clear();

    const stack: Frame[] = [];

    stack.push({
      v: s,
      i: 0,
      neighbors: subgraph.get(s) ?? [],
      foundCycle: false,
    });

    path.length = 0;
    path.push(s);
    blocked.add(s);

    while (stack.length) {
      const frame = stack[stack.length - 1];
      const { v } = frame;

      if (frame.i < frame.neighbors.length) {
        const w = frame.neighbors[frame.i++];

        // Enforce max length before going deeper
        if (path.length >= maxLen) {
          continue;
        }

        if (w === s) {
          // Enforce minimum length
          if (path.length >= minLen) {
            result.push([...path, s]);
          }
          frame.foundCycle = true;
        } else if (!blocked.has(w)) {
          path.push(w);
          stack.push({
            v: w,
            i: 0,
            neighbors: subgraph.get(w) ?? [],
            foundCycle: false,
          });
          blocked.add(w);
        }
      } else {
        // Backtrack
        if (frame.foundCycle) {
          unblock(v);
        } else {
          for (const w of subgraph.get(v) ?? []) {
            B.get(w)!.add(v);
          }
        }

        stack.pop();
        path.pop();

        if (stack.length) {
          stack[stack.length - 1].foundCycle ||= frame.foundCycle;
        }
      }
    }
  }

  return result;
}
