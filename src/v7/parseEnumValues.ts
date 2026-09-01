import { matchMapAttribute, stripLineComment } from '../schemaText';
import type { EnumValues } from '../types';

/**
 * Parse all enum declarations from a Prisma schema string.
 *
 * Returns Map<EnumName, EnumValues> — the ordered member names plus, for members
 * carrying `@map("...")`, the stored DB value keyed by member name.
 *
 * Handles:
 *   - `@map("db_value")` on values — kept as `dbNames`, sparse (absent = the
 *     member name IS the stored value)
 *   - Comments (stripped before parsing)
 *   - Indented enum blocks
 */
export const parseEnumValues = (schema: string): Map<string, EnumValues> => {
  const result = new Map<string, EnumValues>();

  for (const enumMatch of schema.matchAll(/^\s*enum\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm)) {
    const enumName = enumMatch[1];
    const values: string[] = [];
    const dbNames: Record<string, string> = {};

    const lines = enumMatch[2]
      .split('\n')
      .map((line) => stripLineComment(line).trim()) // literal-aware: keeps `@map("a//b")`
      .filter((line) => line && !line.startsWith('@@')); // skip blank lines and block attributes

    for (const line of lines) {
      const name = line.split(/\s+/)[0];
      values.push(name);

      const dbName = matchMapAttribute(line);
      if (dbName !== undefined) dbNames[name] = dbName;
    }

    if (values.length > 0) {
      result.set(enumName, {
        values,
        ...(Object.keys(dbNames).length > 0 ? { dbNames } : {}),
      });
    }
  }

  return result;
};
