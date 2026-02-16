import { workerData as tinypoolData } from 'node:worker_threads';
import { register } from 'tsx/esm/api';

// This file exists so that search-results-worker.ts can be transformed into JS
// usable by worker threads

// Tinypool modifies `workerData` and makes it a tuple of private data and
// user-defined workerData. We're only interested in workerData.
const [, workerData] = tinypoolData;

const api = register({
  // Use scoped registration to ensure tsx caches this wrapper's import.
  // See https://tsx.is/node/esm#scoped-registration
  namespace: 'search-results-worker-wrapper',
});
const { default: reduceToOrderedList } = await api.import(
  './search-results-worker.ts',
  import.meta.url,
);
void api.unregister();

export default {
  default: options => reduceToOrderedList(options),
};
