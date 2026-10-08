/**
 * Strip a `//` line comment from a schema line, ignoring `//` that appears
 * INSIDE a double-quoted string.
 *
 * Both halves matter and each was a real defect:
 *   - not stripping comments lets `email String // was @map("username")` be read
 *     as a column rename, silently selecting the wrong column
 *   - stripping blindly truncates `@map("a//b")`, silently dropping a real one
 *
 * Also drops a trailing `\r` so CRLF schemas behave like LF. Prisma's `///` doc
 * comments start with `//` and are stripped by the same pass.
 */
export const stripLineComment = (line: string): string => {
  let inString = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inString) {
      if (ch === '\\')
        i++; // skip the escaped char
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === '/' && line[i + 1] === '/') return trimCr(line.slice(0, i));
  }

  return trimCr(line);
};

const trimCr = (s: string): string => (s.endsWith('\r') ? s.slice(0, -1) : s);

/**
 * Decode a Prisma string-literal escape sequence.
 *
 * A blanket `\\(.) -> $1` drops meaning: `@map("a\\nb")` is a newline to Prisma,
 * not the letter `n`.
 */
const decodeEscapes = (value: string): string =>
  value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, esc: string) => {
    if (esc[0] === 'u') return String.fromCharCode(Number.parseInt(esc.slice(1), 16));
    const named: Record<string, string> = {
      n: '\n',
      t: '\t',
      r: '\r',
      b: '\b',
      f: '\f',
      '0': '\0',
    };
    return named[esc] ?? esc;
  });

// Prisma accepts `@map("x")`, `@map( "x" )` and `@map(name: "x")` interchangeably.
// Matching only the tight form silently yields the Prisma name as the column —
// the exact wrong-identifier failure this module exists to prevent.
const MAP_VALUE = String.raw`\(\s*(?:name:\s*)?"((?:[^"\\]|\\.)*)"\s*\)`;

// `(?<!@)` so a field-level match can never pick up a model-level `@@map`.
const FIELD_MAP = new RegExp(String.raw`(?<!@)@map${MAP_VALUE}`);
const MODEL_MAP = new RegExp(String.raw`^@@map${MAP_VALUE}`);

/** Field-level `@map(...)` column name. Undefined when absent. */
export const matchMapAttribute = (text: string): string | undefined => {
  const raw = text.match(FIELD_MAP)?.[1];
  return raw === undefined ? undefined : decodeEscapes(raw);
};

/** Model-level `@@map(...)` table name, anchored to the start of a stripped line. */
export const matchModelMapAttribute = (line: string): string | undefined => {
  const raw = line.match(MODEL_MAP)?.[1];
  return raw === undefined ? undefined : decodeEscapes(raw);
};

export type FieldDefaultValue =
  | string
  | number
  | boolean
  | null
  | FieldDefaultValue[]
  | { [key: string]: FieldDefaultValue };

export type FieldDefault =
  | { kind: 'literal'; value: FieldDefaultValue }
  | { kind: 'generated'; expression: string };

const balancedArgument = (text: string, open: number): string | undefined => {
  let depth = 0;
  let inString = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return undefined;
};

const splitTopLevel = (list: string): string[] => {
  const items: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      items.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = list.slice(start).trim();
  if (last) items.push(last);
  return items;
};

const literalValue = (expression: string): FieldDefaultValue | undefined => {
  const quoted = expression.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (quoted) return decodeEscapes(quoted[1]);
  if (expression === 'true' || expression === 'false') return expression === 'true';
  if (/^-?\d+(\.\d+)?$/.test(expression)) return Number(expression);
  if (/^[A-Za-z_]\w*$/.test(expression)) return expression;
  if (expression.startsWith('[') && expression.endsWith(']')) {
    const values = splitTopLevel(expression.slice(1, -1)).map(literalValue);
    return values.every((value) => value !== undefined)
      ? (values as FieldDefaultValue[])
      : undefined;
  }
  return undefined;
};

const defaultAttributeStart = (text: string): number => {
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (
      text.startsWith('@default', i) &&
      text[i - 1] !== '@' &&
      /^@default\s*\(/.test(text.slice(i))
    )
      return i;
  }
  return -1;
};

const typedLiteral = (
  fieldType: string | undefined,
  expression: string,
  value: FieldDefaultValue,
): FieldDefault => {
  if (fieldType === 'Bytes') return { kind: 'generated', expression };
  if (fieldType === 'Json' && typeof value === 'string') {
    try {
      return { kind: 'literal', value: JSON.parse(value) as FieldDefaultValue };
    } catch {
      return { kind: 'generated', expression };
    }
  }
  if ((fieldType === 'BigInt' || fieldType === 'Decimal') && typeof value === 'number')
    return { kind: 'literal', value: expression };
  return { kind: 'literal', value };
};

/**
 * Field-level `@default(...)`. A value the database stores as written (enum member, string,
 * number, boolean, list; Json parsed; BigInt/Decimal kept as exact text) is a `literal` a
 * consumer may inject; a function the database or Prisma evaluates (`now()`, `uuid()`,
 * `dbgenerated(...)`, `autoincrement()`), or a Bytes value, is `generated` and never injected.
 */
export const matchDefaultAttribute = (
  text: string,
  fieldType?: string,
): FieldDefault | undefined => {
  const at = defaultAttributeStart(text);
  if (at === -1) return undefined;
  const expression = balancedArgument(text, text.indexOf('(', at))?.trim();
  if (expression === undefined) return undefined;
  const value = literalValue(expression);
  return value === undefined
    ? { kind: 'generated', expression }
    : typedLiteral(fieldType, expression, value);
};
