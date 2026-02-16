import { workerData as tinypoolData } from 'node:worker_threads';
import { register } from 'tsx/esm/api';

// This file exists so that:
// - search-worker.ts can be transformed into JS usable by worker threads
// - the same search context snapshot can be used by each worker thread

// Tinypool modifies `workerData` and makes it a tuple of private data and
// user-defined workerData. We're only interested in workerData.
const [, workerData] = tinypoolData;

const api = register({
  // Use scoped registration to ensure tsx caches this wrapper's import.
  // See https://tsx.is/node/esm#scoped-registration
  namespace: 'search-worker-wrapper',
});
const { default: searchLngLatRTree } = await api.import(
  './search-worker.ts',
  import.meta.url,
);
void api.unregister();

// HACK:
// Bind the imported function from `search-worker.ts` so that it's always
// passed the `routeContext` object from `workerData`. Doing this limits the
// number of times the large `routeContext` object is cloned; `routeContext` is
// only cloned MAX_THREADS time instead of being cloned every time `findRoutes`
// is called.
export default {
  default: options =>
    searchLngLatRTree({ ...options, rbushJSON: workerData.rbushJSON }),
};
