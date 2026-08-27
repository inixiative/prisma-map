import { autoDetectV7Path } from '../autoDetect';
import type {
  EnumField,
  ModelEntry,
  ModelField,
  PrismaMap,
  RelationField,
  ScalarField,
} from '../types';
import { parseFieldModifiers } from './fieldModifiers';
import { parseInlineSchema } from './inlineSchema';
import { parseEnumValues } from './parseEnumValues';
import { parseRelationFks } from './relationFks';
import { parseRuntimeDataModel } from './runtimeDataModel';
import { parseSchemaStructure } from './schemaStructure';

/**
 * Build a complete PrismaMap from a Prisma v7 generated client directory.
 *
 * @param generatedClientPath - Absolute path to the generated client directory
 *   (the directory containing `internal/class.ts`).
 *   If omitted, auto-detects by walking up from `process.cwd()`.
 *
 * @example
 * ```typescript
 * import { buildPrismaMapV7 } from '@inixiative/prisma-map/v7';
 *
 * const map = buildPrismaMapV7('/path/to/generated/client');
 * // or auto-detect:
 * const map = buildPrismaMapV7();
 * ```
 */
export const buildPrismaMapV7 = (generatedClientPath?: string): PrismaMap => {
  const resolvedPath = generatedClientPath ?? autoDetectV7Path();
  const dataModel = parseRuntimeDataModel(resolvedPath);
  const inlineSchema = parseInlineSchema(resolvedPath);
  const relationFks = parseRelationFks(inlineSchema);
  const enumValuesMap = parseEnumValues(inlineSchema);
  const fieldModifiers = parseFieldModifiers(inlineSchema);
  const structure = parseSchemaStructure(inlineSchema);

  const map: PrismaMap = {};

  for (const [modelName, model] of Object.entries(dataModel.models)) {
    const modelFks = relationFks.get(modelName);
    const modelMods = fieldModifiers.get(modelName);
    const modelStructure = structure.get(modelName);
    const fields: Record<string, ModelField> = {};

    for (const field of model.fields) {
      // Prisma v7's runtimeDataModel omits isList/isRequired/isId — read them from the schema.
      const mods = modelMods?.get(field.name);
      const isList = mods?.isList ?? field.isList ?? false;
      const isRequired = mods?.isRequired ?? field.isRequired ?? true;
      const isId = mods?.isId ?? field.isId ?? false;
      const fieldAnno = modelStructure?.fields.get(field.name);
      const withAnno = fieldAnno ? { annotations: fieldAnno } : {};
      const withDbName = mods?.dbName ? { dbName: mods.dbName } : {};

      if (field.kind === 'scalar') {
        const scalarField: ScalarField = {
          kind: 'scalar',
          type: field.type,
          isRequired,
          isList,
          isId,
          ...withDbName,
          ...withAnno,
        };
        fields[field.name] = scalarField;
      } else if (field.kind === 'enum') {
        const enumField: EnumField = {
          kind: 'enum',
          type: field.type,
          isRequired,
          isList,
          values: enumValuesMap.get(field.type) ?? [],
          ...withDbName,
          ...withAnno,
        };
        fields[field.name] = enumField;
      } else if (field.kind === 'object') {
        const fkMapping = modelFks?.get(field.name);
        const relationField: RelationField = {
          kind: 'object',
          type: field.type,
          isList,
          isRequired,
          ...(field.relationName ? { relationName: field.relationName } : {}),
          fromFields: fkMapping?.fields ?? [],
          toFields: fkMapping?.references ?? [],
          ...withAnno,
        };
        fields[field.name] = relationField;
      }
    }

    map[modelName] = {
      dbName: model.dbName,
      fields,
      ...(modelStructure?.indexes.length ? { indexes: modelStructure.indexes } : {}),
      ...(modelStructure?.annotations ? { annotations: modelStructure.annotations } : {}),
    } satisfies ModelEntry;
  }

  return map;
};
