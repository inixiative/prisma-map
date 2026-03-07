import type {
  EnumField,
  ModelEntry,
  ModelField,
  PrismaMap,
  RelationField,
  ScalarField,
} from '../types';
import { parseRelationFks } from '../v7/relationFks';

/**
 * Parse a Prisma schema string into a PrismaMap.
 *
 * Classifies fields as scalar/enum/object by scanning all model and enum
 * declarations first, then parsing each model's fields line by line.
 * FK info is extracted via the same @relation parser used for v7.
 */
export const parseSchemaText = (schema: string): PrismaMap => {
  const modelNames = new Set<string>();
  const enumNames = new Set<string>();

  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{/gm)) modelNames.add(m[1]);
  for (const m of schema.matchAll(/^enum\s+(\w+)\s*\{/gm)) enumNames.add(m[1]);

  const relationFks = parseRelationFks(schema);
  const map: PrismaMap = {};

  for (const modelMatch of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\s*\}/g)) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2];
    const fields: Record<string, ModelField> = {};

    for (const rawLine of modelBody.split('\n')) {
      const parsed = parseFieldLine(rawLine, modelName, modelNames, enumNames, relationFks);
      if (parsed) fields[parsed.name] = parsed.field;
    }

    // Mark fields that are part of a composite PK (@@id([field1, field2]))
    const compoundIdMatch = modelBody.match(/@@id\s*\(\s*\[([^\]]+)\]/);
    if (compoundIdMatch) {
      for (const name of compoundIdMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        const f = fields[name];
        if (f?.kind === 'scalar') fields[name] = { ...f, isId: true };
      }
    }

    const dbNameMatch = modelBody.match(/@@map\("([^"]+)"\)/);
    map[modelName] = { dbName: dbNameMatch?.[1] ?? null, fields } satisfies ModelEntry;
  }

  return map;
};

const parseFieldLine = (
  rawLine: string,
  modelName: string,
  modelNames: Set<string>,
  enumNames: Set<string>,
  relationFks: Map<string, Map<string, { fields: string[]; references: string[] }>>,
): { name: string; field: ModelField } | null => {
  const line = rawLine.trim();

  // Skip blank lines, block-level attributes, comments
  if (!line || line.startsWith('//') || line.startsWith('@@') || line.startsWith('@')) return null;

  // fieldName TypeName?  or  fieldName TypeName[]
  const match = line.match(/^(\w+)\s+(\w+)(\?)?(\[\])?\s*(.*)?$/);
  if (!match) return null;

  const [, fieldName, typeName, optional, list] = match;
  const rest = match[5] ?? '';
  const isRequired = !optional;
  const isList = !!list;
  const isId = /@id\b/.test(rest);

  if (modelNames.has(typeName)) {
    const fkMapping = relationFks.get(modelName)?.get(fieldName);
    const field: RelationField = {
      kind: 'object',
      type: typeName,
      isList,
      isRequired,
      fromFields: fkMapping?.fields ?? [],
      toFields: fkMapping?.references ?? [],
    };
    return { name: fieldName, field };
  }

  if (enumNames.has(typeName)) {
    const field: EnumField = { kind: 'enum', type: typeName, isRequired, isList };
    return { name: fieldName, field };
  }

  const field: ScalarField = { kind: 'scalar', type: typeName, isRequired, isList, isId };
  return { name: fieldName, field };
};
