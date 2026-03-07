import { readFileSync } from 'fs';
import { join } from 'path';

export const readGeneratedClient = (generatedClientPath: string): string => {
  const classPath = join(generatedClientPath, 'internal', 'class.ts');
  return readFileSync(classPath, 'utf-8');
};
