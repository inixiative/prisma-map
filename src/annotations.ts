import type { Annotations, AnnoValue } from './types';

// Coerce a raw value token into an AnnoValue.
//   true / false        → boolean
//   123 / -1.5          → number
//   "quoted"            → string (unquoted)
//   bare word (parent)  → string
// Arrays are handled by the caller; scalars only here.
const coerceScalar = (raw: string): string | number | boolean => {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  const quoted = value.match(/^"(.*)"$/);
  if (quoted) return quoted[1];
  return value;
};

const coerceValue = (raw: string): AnnoValue => {
  const value = raw.trim();
  const list = value.match(/^\[(.*)\]$/);
  if (list) {
    return list[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map(coerceScalar);
  }
  return coerceScalar(value);
};

// Parse the `key: value` payload inside one `@tagClass(...)` call. Splits on
// commas that are not inside a `[...]` list, so array values survive.
const parsePayload = (body: string): Record<string, AnnoValue> => {
  const entries: Record<string, AnnoValue> = {};
  // key : ( bracketed list | quoted string | run up to the next comma )
  for (const match of body.matchAll(/(\w+)\s*:\s*(\[[^\]]*\]|"[^"]*"|[^,]+)/g)) {
    entries[match[1]] = coerceValue(match[2]);
  }
  return entries;
};

/**
 * Parse `@tagClass(key: value, ...)` annotations out of doc-comment text.
 *
 * The text is the content of one or more `///` lines (joined). Any number of tag
 * classes may appear; later keys within the same tag class win. Returns
 * `undefined` when no tag class is present, so callers can omit the field.
 *
 * @example
 * parseTagClasses('@tree(parent: true) @order(by: position, dir: asc)')
 * // → { tree: { parent: true }, order: { by: 'position', dir: 'asc' } }
 */
export const parseTagClasses = (text: string): Annotations | undefined => {
  const result: Annotations = {};
  let found = false;

  for (const match of text.matchAll(/@(\w+)\(([^)]*)\)/g)) {
    found = true;
    const tagClass = match[1];
    result[tagClass] = { ...result[tagClass], ...parsePayload(match[2]) };
  }

  return found ? result : undefined;
};
