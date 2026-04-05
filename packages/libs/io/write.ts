import type { GraphData, MapData } from '@truckermudgeon/map/types';
import * as fs from 'node:fs';

export function writeArrayFile(
  array: MapData[keyof MapData],
  outputFile: string,
): void;
export function writeArrayFile(array: unknown[], outputFile: string): void {
  fs.writeFileSync(outputFile, JSON.stringify(array, null, 2));
}

export function writeGraphFile(graph: GraphData, outputFile: string): void {
  fs.writeFileSync(outputFile, JSON.stringify(graph, graphSerializer, 2));
}

export function writeGeojsonFile(
  path: string,
  data: GeoJSON.FeatureCollection,
) {
  const fd = fs.openSync(path, 'w');
  let pos = 0;
  const writeln = (str: string) =>
    (pos += fs.writeSync(fd, str + '\n', pos, 'utf-8'));

  writeln('{');
  writeln('"type": "FeatureCollection",');
  writeln('"features":[');
  for (let i = 0; i < data.features.length; i++) {
    const feature = data.features[i];
    if (i !== data.features.length - 1) {
      writeln(JSON.stringify(feature) + ',');
    } else {
      writeln(JSON.stringify(feature));
    }
  }
  writeln(']');
  writeln('}');
  fs.closeSync(fd);
}

function graphSerializer(key: string, value: unknown) {
  if (key === 'distance' && typeof value === 'number') {
    return Number(value.toFixed(2));
  }
  if (value instanceof Set) {
    return [...value] as unknown[];
  }
  if (value instanceof Map) {
    return [...value.entries()] as unknown[];
  }
  return value;
}

// Ensure `BigInt`s are `JSON.serialize`d as hex strings, so they can be
// `JSON.parse`d without any data loss.
//
// This must be done before executing any other code that might involve
// serializing bigints to JSON).

// eslint-disable-next-line
interface BigIntWithToJSON extends BigInt {
  toJSON(): string;
}

(BigInt.prototype as BigIntWithToJSON).toJSON = function () {
  return this.toString(16);
};
