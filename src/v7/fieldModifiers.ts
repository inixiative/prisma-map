export type FieldModifiers = {
  isList: boolean;
  isRequired: boolean;
  isId: boolean;
  dbName?: string; // column name from `@map("...")`; absent = field name IS the column
};

/**
 * Parse per-field modifiers (isList / isRequired / isId / @map dbName) from
 * schema text.
 *
 * Prisma v7's embedded runtimeDataModel omits these, so they must come from the
 * inlineSchema — the `Type[]` / `Type?` / `@id` / `@@id([...])` / `@map("...")`
 * syntax. Returns Map<ModelName, Map<FieldName, FieldModifiers>>.
 */
export const parseFieldModifiers = (schema: string): Map<string, Map<string, FieldModifiers>> => {
  const result = new Map<string, Map<string, FieldModifiers>>();

  for (const modelMatch of schema.matchAll(/^\s*model\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm)) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2];
    const fieldMods = new Map<string, FieldModifiers>();
    const compoundId: string[] = [];

    for (const rawLine of modelBody.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//')) continue;

      const compound = line.match(/@@id\s*\(\s*\[([^\]]+)\]/);
      if (compound) {
        for (const name of compound[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean))
          compoundId.push(name);
        continue;
      }
      if (line.startsWith('@@') || line.startsWith('@')) continue;

      const match = line.match(/^(\w+)\s+([A-Za-z_]\w*)(?:\([^)]*\))?(\?)?(\[\])?\s*(.*)?$/);
      if (!match) continue;

      const [, fieldName, , optional, list] = match;
      const rest = match[5] ?? '';
      const dbName = rest.match(/@map\("([^"]+)"\)/)?.[1];
      fieldMods.set(fieldName, {
        isList: !!list,
        isRequired: !optional,
        isId: /@id\b/.test(rest),
        ...(dbName ? { dbName } : {}),
      });
    }

    for (const name of compoundId) {
      const mods = fieldMods.get(name);
      if (mods) mods.isId = true;
    }

    result.set(modelName, fieldMods);
  }

  return result;
};
