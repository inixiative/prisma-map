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

/** `@map("...")` value, honouring backslash escapes. Undefined when absent. */
export const matchMapAttribute = (text: string): string | undefined => {
  const raw = text.match(/@map\("((?:[^"\\]|\\.)*)"\)/)?.[1];
  return raw === undefined ? undefined : raw.replace(/\\(.)/g, '$1');
};
