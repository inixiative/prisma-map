import { autoDetectV7Path } from '../autoDetect';
import type {
  EnumField,
  ModelEntry,
  ModelField,
  PrismaMap,
  RelationField,
  ScalarField,
} from '../types';
import { parseInlineSchema } from './inlineSchema';
import { parseEnumValues } from './parseEnumValues';
import { parseRelationFks } from './relationFks';
import { parseRuntimeDataModel } from './runtimeDataModel';

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

  const map: PrismaMap = {};

  for (const [modelName, model] of Object.entries(dataModel.models)) {
    const modelFks = relationFks.get(modelName);
    const fields: Record<string, ModelField> = {};

    for (const field of model.fields) {
      if (field.kind === 'scalar') {
        const scalarField: ScalarField = {
          kind: 'scalar',
          type: field.type,
          isRequired: field.isRequired,
          isList: field.isList,
          isId: field.isId,
        };
        fields[field.name] = scalarField;
      } else if (field.kind === 'enum') {
        const enumField: EnumField = {
          kind: 'enum',
          type: field.type,
          isRequired: field.isRequired,
          isList: field.isList,
          values: enumValuesMap.get(field.type) ?? [],
        };
        fields[field.name] = enumField;
      } else if (field.kind === 'object') {
        const fkMapping = modelFks?.get(field.name);
        const relationField: RelationField = {
          kind: 'object',
          type: field.type,
          isList: field.isList,
          isRequired: field.isRequired,
          ...(field.relationName ? { relationName: field.relationName } : {}),
          fromFields: fkMapping?.fields ?? [],
          toFields: fkMapping?.references ?? [],
        };
        fields[field.name] = relationField;
      }
    }

    map[modelName] = { dbName: model.dbName, fields } satisfies ModelEntry;
  }

  return map;
};
