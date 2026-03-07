import { readFileSync } from 'fs';
import { join } from 'path';
import type { RuntimeDataModel, RelationFkMapping } from './types';

/**
 * Prisma v7 embeds two things in `generated/client/internal/class.ts`:
 *  1. runtimeDataModel — compact field info (name, kind, type, isRequired, isList, isId, relationName)
 *  2. inlineSchema — the full schema.prisma text
 *
 * runtimeDataModel lacks relationFromFields/relationToFields, so we parse
 * inlineSchema to extract @relation(fields: [...], references: [...]) mappings.
 */

const readGeneratedClient = (generatedClientPath: string): string => {
  const classPath = join(generatedClientPath, 'internal', 'class.ts');
  return readFileSync(classPath, 'utf-8');
};

export const parseRuntimeDataModel = (generatedClientPath: string): RuntimeDataModel => {
  const content = readGeneratedClient(generatedClientPath);

  const match = content.match(/config\.runtimeDataModel\s*=\s*JSON\.parse\("(.+?)"\)/s);
  if (!match) {
    throw new Error(
      `Could not extract runtimeDataModel from generated client at: ${generatedClientPath}\n` +
        `Ensure this is a Prisma v7 generated client directory (contains internal/class.ts).`,
    );
  }

  const jsonString = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return JSON.parse(jsonString) as RuntimeDataModel;
};

export const parseInlineSchema = (generatedClientPath: string): string => {
  const content = readGeneratedClient(generatedClientPath);

  const match = content.match(/"inlineSchema":\s*"(.+?)(?<!\\)",/s);
  if (!match) {
    throw new Error(
      `Could not extract inlineSchema from generated client at: ${generatedClientPath}`,
    );
  }

  return match[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
};

/**
 * Parse all @relation(fields: [...], references: [...]) annotations from schema text.
 *
 * Returns Map<ModelName, Map<RelationFieldName, { fields, references }>>
 *
 * Only the owning side of a relation has `fields: [...]` — back-relations
 * (e.g. `posts Post[]`) will not appear in this map, and their fromFields/toFields
 * will be empty arrays in the final PrismaMap.
 *
 * Handles all @relation forms:
 *   @relation(fields: [...], references: [...])
 *   @relation("Name", fields: [...], references: [...])
 *   @relation(name: "Name", fields: [...], references: [...])
 */
export const parseRelationFks = (
  schema: string,
): Map<string, Map<string, RelationFkMapping>> => {
  const result = new Map<string, Map<string, RelationFkMapping>>();

  // Use \n} as end delimiter to avoid matching {} inside @default("{}")
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let modelMatch: RegExpExecArray | null;

  while ((modelMatch = modelRegex.exec(schema)) !== null) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2];
    const fieldFks = new Map<string, RelationFkMapping>();

    // Match: fieldName Type?[]? @relation(optional name, fields: [...], references: [...])
    // \w+\??(?:\[\])? handles: Post, Post?, Post[], Post[]?
    const relationRegex =
      /(\w+)\s+\w+\??(?:\[\])?\s+@relation\s*\(\s*(?:(?:"[^"]*"|name:\s*"[^"]*")\s*,\s*)?fields:\s*\[([^\]]+)\]\s*,\s*references:\s*\[([^\]]+)\]/g;
    let relMatch: RegExpExecArray | null;

    while ((relMatch = relationRegex.exec(modelBody)) !== null) {
      const fieldName = relMatch[1];
      const fields = relMatch[2].split(',').map((s) => s.trim()).filter(Boolean);
      const references = relMatch[3].split(',').map((s) => s.trim()).filter(Boolean);
      fieldFks.set(fieldName, { fields, references });
    }

    if (fieldFks.size > 0) {
      result.set(modelName, fieldFks);
    }
  }

  return result;
};
