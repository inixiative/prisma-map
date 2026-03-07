import { existsSync } from 'fs';
import { dirname, join } from 'path';

const CANDIDATE_DIRS = [
  'node_modules/.prisma/client',
  'node_modules/@prisma/client',
  'prisma/generated/client',
  'src/generated/client',
  'src/generated/prisma',
  'generated/client',
];

const walkUp = (startDir: string, check: (dir: string) => boolean): string | null => {
  let dir = startDir;
  while (true) {
    for (const candidate of CANDIDATE_DIRS) {
      const fullPath = join(dir, candidate);
      if (check(fullPath)) return fullPath;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

/**
 * Auto-detect a Prisma v7 generated client directory by looking for `internal/class.ts`.
 * Walks up from startDir (defaults to process.cwd()) checking common output locations.
 */
export const autoDetectV7Path = (startDir: string = process.cwd()): string => {
  const found = walkUp(startDir, (dir) => existsSync(join(dir, 'internal', 'class.ts')));
  if (!found) {
    throw new Error(
      'Could not auto-detect Prisma v7 generated client directory.\n' +
        'Pass the path explicitly: buildPrismaMapV7("/path/to/generated/client")',
    );
  }
  return found;
};

/**
 * Auto-detect a Prisma v6 generated client directory by looking for `schema.prisma`
 * without `internal/class.ts` (which would indicate v7).
 * Walks up from startDir (defaults to process.cwd()) checking common output locations.
 */
export const autoDetectV6Path = (startDir: string = process.cwd()): string => {
  const found = walkUp(
    startDir,
    (dir) =>
      existsSync(join(dir, 'schema.prisma')) && !existsSync(join(dir, 'internal', 'class.ts')),
  );
  if (!found) {
    throw new Error(
      'Could not auto-detect Prisma v6 generated client directory.\n' +
        'Pass the path explicitly: buildPrismaMapV6("/path/to/generated/client")',
    );
  }
  return found;
};
