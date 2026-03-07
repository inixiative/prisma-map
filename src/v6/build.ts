import { autoDetectV6Path } from '../autoDetect';
import type { PrismaMap } from '../types';
import { buildFromSchemaFile } from './parseSchemaFile';

/**
 * Build a complete PrismaMap from a Prisma v6 generated client directory.
 *
 * Reads `schema.prisma` which Prisma copies to the output directory and
 * parses all models, fields, and @relation FK annotations from it.
 *
 * @param generatedClientPath - Absolute path to the generated client directory
 *   (the directory containing `schema.prisma`).
 *   If omitted, auto-detects by walking up from `process.cwd()`.
 *
 * @example
 * ```typescript
 * import { buildPrismaMapV6 } from '@inixiative/prisma-map/v6';
 *
 * const map = buildPrismaMapV6('/path/to/generated/client');
 * // or auto-detect:
 * const map = buildPrismaMapV6();
 * ```
 */
export const buildPrismaMapV6 = (generatedClientPath?: string): PrismaMap => {
  const resolvedPath = generatedClientPath ?? autoDetectV6Path();
  return buildFromSchemaFile(resolvedPath);
};
