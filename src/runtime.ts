/**
 * The browser-safe part of prisma-map: reading a map that already exists.
 * No builders here; `buildPrismaMapV6` / `buildPrismaMapV7` read files and stay on the main entry.
 */
export { parseTagClasses } from './annotations';
export { getColumns, pickColumns } from './columns';
export {
  columnName,
  hasColumn,
  isEnumField,
  isScalarField,
  storedValue,
  tableName,
} from './identifiers';
export { getRelations, relationForeignKey } from './relations';
export type { FieldDefault, FieldDefaultValue } from './schemaText';
export type {
  Annotations,
  AnnoValue,
  DbIdentifier,
  DbValue,
  EnumField,
  EnumValues,
  Identifier,
  IndexEntry,
  IndexKind,
  ModelEntry,
  ModelField,
  PrismaMap,
  RelationField,
  RelationInfo,
  ScalarField,
} from './types';
