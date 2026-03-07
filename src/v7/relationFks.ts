import type { RelationFkMapping } from '../types';

/**
 * Parse all @relation(fields: [...], references: [...]) annotations from schema text.
 *
 * Returns Map<ModelName, Map<RelationFieldName, { fields, references }>>
 *
 * Only the owning side of a relation has `fields: [...]` — back-relations
 * (e.g. `posts Post[]`) will not appear in this map, and their fromFields/toFields
 * will be empty arrays in the final PrismaMap.
 *
 * Handles all @relation forms and any argument ordering:
 *   @relation(fields: [...], references: [...])
 *   @relation(references: [...], fields: [...])
 *   @relation("Name", fields: [...], references: [...])
 *   @relation(name: "Name", fields: [...], references: [...], onDelete: Cascade)
 */
export const parseRelationFks = (schema: string): Map<string, Map<string, RelationFkMapping>> => {
  const result = new Map<string, Map<string, RelationFkMapping>>();

  // Use \n} as end delimiter to avoid matching {} inside @default("{}")
  for (const modelMatch of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\s*\}/g)) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2];
    const fieldFks = new Map<string, RelationFkMapping>();

    // Step 1: find lines with @relation(...) — capture fieldName and the full args string.
    // [^\n]*? allows any attributes between the type and @relation (e.g. @ignore, @map).
    // @relation args never contain nested parens, so [^)]* safely captures the full arg list.
    for (const relMatch of modelBody.matchAll(
      /(\w+)[^\S\n]+\w+\??(?:\[\])?[^\n]*?@relation\s*\(([^)]*)\)/g,
    )) {
      const fieldName = relMatch[1];
      const args = relMatch[2];

      // Step 2: extract fields: [...] and references: [...] independently (order-agnostic)
      const fieldsMatch = args.match(/fields:\s*\[([^\]]*)\]/);
      const refsMatch = args.match(/references:\s*\[([^\]]*)\]/);

      // Back-relations and @relation("name") forms have no FK info — skip them
      if (!fieldsMatch || !refsMatch) continue;

      const fields = fieldsMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const references = refsMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      fieldFks.set(fieldName, { fields, references });
    }

    if (fieldFks.size > 0) {
      result.set(modelName, fieldFks);
    }
  }

  return result;
};
