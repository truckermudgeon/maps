import { Preconditions } from '@truckermudgeon/base/precon';
import type { JSONSchemaType } from 'ajv';
import { logger } from '../logger';
import type { Entries } from './scs-archive';
import { parseSii } from './sii-parser';
import { ajv } from './sii-schemas';
import { jsonConverter } from './sii-visitors';

export function convertSiiToJson<T>(
  siiPath: string,
  entries: Entries,
  schema: JSONSchemaType<T>,
): T {
  logger.debug('converting', siiPath, 'to json object');
  const siiFile = Preconditions.checkExists(
    entries.files.get(siiPath),
    `${siiPath} does not exist`,
  );
  const buffer = siiFile.read();

  // Some .sii files (like locale files) may be 3nk-encrypted.
  let sii;
  const magic = buffer.toString('utf8', 0, 3);
  if (magic === '3nK') {
    // https://github.com/dariowouters/ts-map/blob/e73adad923f60bbbb637dd4642910d1a0b1154e3/TsMap/Helpers/MemoryHelper.cs#L109
    if (buffer.length < 5) {
      throw new Error();
    }
    let key = buffer.readUint8(5);
    for (let i = 6; i < buffer.length; i++) {
      buffer[i] = (((key << 2) ^ (key ^ 0xff)) << 3) ^ key ^ buffer[i];
      key++;
    }
    sii = buffer.toString('utf8', 6);
  } else {
    sii = buffer.toString();
  }

  // HACK localization.sui files just contain unwrapped properties, e.g.:
  //   key[]: foo
  //   val[]: bar
  // Hardcode a wrapper so parsing still works.
  if (
    siiPath.includes('localization.sui') ||
    siiPath.includes('photoalbum.sui')
  ) {
    sii = `localizationDb : .localization {${sii}}`;
  }

  const res = parseSii(sii);
  if (!res.ok) {
    logger.error('error parsing', siiPath);
    if (res.parseErrors.length) {
      const line = res.parseErrors[0].token.startLine!;
      const lines = sii.split('\n');
      logger.error(lines.slice(line - 1, line + 1).join('\n'));
      logger.error(res.parseErrors);
    } else {
      logger.error(res.lexErrors);
    }
    throw new Error();
  }

  const json = jsonConverter.convert(res.cst);
  const validate = ajv.compile(schema);
  if (validate(json)) {
    return json;
  }
  logger.error('error validating', siiPath);
  console.log(JSON.stringify(json, null, 2));
  logger.error(ajv.errorsText(validate.errors));
  throw new Error();
}
