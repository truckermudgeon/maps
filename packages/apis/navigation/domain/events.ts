export type DomainEvent =
  | {
      type: 'assertionFailed';
      where: string;
      data: Record<
        string,
        string | number | boolean | (string | number | boolean)[]
      >;
    }
  | {
      type: 'info';
      where: string;
      data: Record<
        string,
        string | number | boolean | (string | number | boolean)[]
      >;
    }
  | { type: 'error'; code: string; message: string; data: unknown }
  | { type: 'routeRecalculated'; code: string };

export interface DomainEventSink {
  publish(event: DomainEvent): void;
}
