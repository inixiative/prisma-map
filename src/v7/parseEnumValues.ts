/**
 * Parse all enum declarations from a Prisma schema string.
 *
 * Returns Map<EnumName, string[]> — the ordered list of member names.
 *
 * Handles:
 *   - @map("db_name") annotations on values (ignored — only name is kept)
 *   - Comments (stripped before parsing)
 *   - Indented enum blocks
 */
export const parseEnumValues = (schema: string): Map<string, string[]> => {
  const result = new Map<string, string[]>();

  for (const enumMatch of schema.matchAll(/^\s*enum\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm)) {
    const enumName = enumMatch[1];
    const values = enumMatch[2]
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim()) // strip inline comments
      .filter((line) => line && !line.startsWith('@@')) // skip blank lines and block attributes
      .map((line) => line.split(/\s+/)[0]); // value name only (ignore @map etc.)

    if (values.length > 0) result.set(enumName, values);
  }

  return result;
};
