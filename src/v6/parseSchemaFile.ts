import { readFileSync } from 'fs';
import { join } from 'path';
import type { PrismaMap } from '../types';
import { parseSchemaText } from './parseSchemaText';

export const buildFromSchemaFile = (generatedClientPath: string): PrismaMap => {
  const schemaPath = join(generatedClientPath, 'schema.prisma');
  const schema = readFileSync(schemaPath, 'utf-8');
  return parseSchemaText(schema);
};
