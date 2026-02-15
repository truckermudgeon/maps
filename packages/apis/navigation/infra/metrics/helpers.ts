import { putIfAbsent } from '@truckermudgeon/base/map';

export abstract class ConsoleMetrics {
  private counters = new Map<string, number>();

  protected inc(name: string, ...args: unknown[]) {
    const curCount = putIfAbsent(name, 0, this.counters);
    this.counters.set(name, curCount + 1);
    console.log(name, 'inc. new value:', curCount + 1, args);
  }

  protected dec(name: string, ...args: unknown[]) {
    const curCount = putIfAbsent(name, 0, this.counters);
    this.counters.set(name, curCount - 1);
    console.log(name, 'dec. new value:', curCount - 1, args);
  }

  protected observe(name: string, value: unknown, ...args: unknown[]) {
    console.log(name, 'observe:', value, args);
  }
}
