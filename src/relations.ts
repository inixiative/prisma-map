import type { Identifier, PrismaMap, RelationField, RelationInfo } from './types';

/**
 * Collapse a relation's FK columns into a lookup Identifier.
 *
 * - `fromFields = []` (back-relations) → `null`
 * - a single same-named pair → the bare field name (string)
 * - otherwise → a `{ referencedField: localField }` map
 *
 * Mismatched-length / empty pairs yield `null`.
 */
export const relationForeignKey = (field: RelationField): Identifier | null => {
  const { fromFields, toFields } = field;
  if (fromFields.length === 0 || fromFields.length !== toFields.length) return null;
  if (fromFields.length === 1 && fromFields[0] === toFields[0]) return fromFields[0];

  const composite: Record<string, string> = {};
  for (let i = 0; i < fromFields.length; i++) composite[toFields[i]] = fromFields[i];
  return composite;
};

/**
 * List the relation fields of a model as RelationInfo (relation name, target
 * model, list-ness, collapsed foreign key, and any annotations).
 *
 * String-keyed and ORM-agnostic — callers needing typed model/accessor names
 * wrap this with their own generated types.
 *
 * @throws if `modelName` is not in the map.
 */
export const getRelations = (map: PrismaMap, modelName: string): RelationInfo[] => {
  const model = map[modelName];
  if (!model) throw new Error(`Model ${modelName} not found in PrismaMap`);

  const relations: RelationInfo[] = [];
  for (const [relationName, field] of Object.entries(model.fields)) {
    if (field.kind !== 'object') continue;
    relations.push({
      relationName,
      targetModel: field.type,
      isList: field.isList,
      foreignKey: relationForeignKey(field),
      ...(field.annotations ? { annotations: field.annotations } : {}),
    });
  }
  return relations;
};
