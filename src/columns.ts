import { hasColumn } from './identifiers';
import type { PrismaMap } from './types';

/**
 * List the field names of a model's columns (scalar and enum fields), in
 * schema order. The counterpart of `getRelations`.
 *
 * @throws if `modelName` is not in the map.
 */
export const getColumns = (map: PrismaMap, modelName: string): string[] => {
  const model = map[modelName];
  if (!model) throw new Error(`Model ${modelName} not found in PrismaMap`);
  return Object.entries(model.fields)
    .filter(([, field]) => hasColumn(field))
    .map(([name]) => name);
};

/**
 * Keep only a row's column keys, dropping included relations and anything else
 * that is not a column of the model.
 *
 * @throws if `modelName` is not in the map.
 */
export const pickColumns = <T extends Record<string, unknown>>(
  map: PrismaMap,
  modelName: string,
  row: T,
): Partial<T> => {
  const columns = new Set(getColumns(map, modelName));
  return Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key))) as Partial<T>;
};
