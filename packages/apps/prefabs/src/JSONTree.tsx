import {
  JSONTree as _JSONTree,
  type GetItemString,
  type ShouldExpandNodeInitially,
} from 'react-json-tree';

export const JSONTree = ({ data }: { data: unknown }) => (
  <div style={{ fontSize: '90%', lineHeight: 1.1 }}>
    <_JSONTree
      data={data}
      theme={{ extend: 'monokai', base00: 'transparent' }}
      invertTheme={true}
      hideRoot={true}
      shouldExpandNodeInitially={shouldExpandNodeInitially}
      getItemString={getItemString}
      postprocessValue={to4}
    />
  </div>
);

const isPrimitive = (v: unknown) => {
  const typeofv = typeof v;
  return typeofv !== 'object' && typeofv !== 'function';
};

const to4 = (v: unknown) => {
  if (typeof v === 'number') {
    return Number(v.toFixed(4));
  }
  return v;
};

const shouldExpandNodeInitially: ShouldExpandNodeInitially = (
  keyPath,
  data,
) => {
  if (keyPath.length === 1 && keyPath[0] === 'navCurves') {
    return false;
  }
  return !(
    data == null ||
    (Array.isArray(data) && data.every(isPrimitive)) ||
    (typeof data === 'object' && Object.values(data).every(isPrimitive))
  );
};

const getItemString: GetItemString = (nodeType, data) => {
  if (nodeType === 'Array') {
    return (data as unknown[]).every(isPrimitive)
      ? `[ ` + (data as unknown[]).map(to4).join(', ') + ` ]`
      : `[] ${(data as unknown[]).length} items`;
  }

  if (nodeType === 'Object') {
    const entries = Object.entries(data as object);
    return entries.map(([, value]) => value as unknown).every(isPrimitive)
      ? `{ ` +
          entries
            .map(([key, value]) => `${key}: ${String(to4(value))}`)
            .slice(0, 3)
            .join(', ') +
          `${entries.length > 3 ? ', ...' : ''}` +
          ` }`
      : `{} ${entries.length} keys`;
  }

  return null;
};
