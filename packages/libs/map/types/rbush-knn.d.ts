import type RBush from 'rbush';

declare module 'rbush-knn' {
  export default function knn<T>(
    tree: RBush<T>,
    x: number,
    y: number,
    n: number,
    predicate: (t: T) => boolean = () => true,
    maxDistance: number = Infinity,
  ): T[];
}
