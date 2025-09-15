import fs from 'fs';

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
