import type { EnumField, ModelEntry, ScalarField } from './types';

/**
 * Resolve the physical DB identifiers behind a PrismaMap node.
 *
 * Every key in a PrismaMap is the PRISMA-side name — `map.User`,
 * `map.User.fields.createdAt`, `values: ['ADMIN']`. `@map`/`@@map` are the only
 * places the two surfaces diverge, and they are carried sparsely: absent means
 * the Prisma name IS the DB identifier.
 *
 * Use these instead of open-coding `?? name` at the call site — a missed
 * fallback fails silently (an unmapped enum member selects zero rows rather
 * than erroring).
 */

/** Table name for a model — `@@map` if present, else the model name. */
export const tableName = (model: ModelEntry, modelName: string): string =>
  model.dbName ?? modelName;

/**
 * Column name for a scalar or enum field — `@map` if present, else the field
 * name. Relation fields are not accepted: they have no column.
 */
export const columnName = (field: ScalarField | EnumField, fieldName: string): string =>
  field.dbName ?? fieldName;

/**
 * Stored DB value for an enum member — the member's `@map` if present, else the
 * member name. `MissionTypeName.SOCIAL_POST @map("Social Post")` stores
 * `'Social Post'`, so comparing against `'SOCIAL_POST'` matches nothing.
 */
export const storedValue = (field: EnumField, member: string): string =>
  field.valueDbNames?.[member] ?? member;
