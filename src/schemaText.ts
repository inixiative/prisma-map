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
