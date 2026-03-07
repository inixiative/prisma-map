import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const readGeneratedClient = (generatedClientPath: string): string => {
  const classPath = join(generatedClientPath, 'internal', 'class.ts');
  return readFileSync(classPath, 'utf-8');
};
