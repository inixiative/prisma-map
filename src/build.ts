import { parseRuntimeDataModel, parseInlineSchema, parseRelationFks } from './parse';
import type {
  PrismaMap,
  ModelEntry,
  ModelField,
  ScalarField,
  EnumField,
  RelationField,
} from './types';

/**
 * Build a complete PrismaMap from a Prisma v7 generated client directory.
 *
 * @param generatedClientPath - Absolute path to the generated client directory
 *   (the directory containing `internal/class.ts`).
 *   e.g. `/path/to/project/src/generated/client`
 *
 * @returns PrismaMap — all models with their fields, kinds, and FK info
 *
 * @example
 * ```typescript
 * import { buildPrismaMap } from '@inixiative/prisma-map';
 *
 * const map = buildPrismaMap('/path/to/generated/client');
 *
 * map.User.fields.email
 * // → { kind: 'scalar', type: 'String', isRequired: true, isList: false, isId: false }
 *
 * map.Post.fields.author
 * // → { kind: 'object', type: 'User', isList: false, isRequired: true, fromFields: ['authorId'], toFields: ['id'] }
 *
 * map.User.fields.posts
 * // → { kind: 'object', type: 'Post', isList: true, isRequired: false, fromFields: [], toFields: [] }
 * ```
 */
export const buildPrismaMap = (generatedClientPath: string): PrismaMap => {
  const dataModel = parseRuntimeDataModel(generatedClientPath);
  const inlineSchema = parseInlineSchema(generatedClientPath);
  const relationFks = parseRelationFks(inlineSchema);

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

    const entry: ModelEntry = {
      dbName: model.dbName,
      fields,
    };

    map[modelName] = entry;
  }

  return map;
};
