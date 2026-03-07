import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Create a temp directory with the internal/ sub-folder Prisma v7 expects. */
export const makeFixtureDir = (): string => {
  const dir = join(tmpdir(), `prisma-map-test-${Date.now()}`);
  mkdirSync(join(dir, 'internal'), { recursive: true });
  return dir;
};

/**
 * Produce the contents of `internal/class.ts` for a Prisma v7 generated client fixture.
 * Embeds the given runtimeDataModel (as JSON) and inlineSchema text.
 */
export const makeClassTs = (runtimeDataModel: object, inlineSchema: string): string => {
  const jsonStr = JSON.stringify(JSON.stringify(runtimeDataModel)).slice(1, -1);
  const schemaEscaped = inlineSchema
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  return `
// Prisma generated client stub
config.runtimeDataModel = JSON.parse("${jsonStr}")
const x = {
  "inlineSchema": "${schemaEscaped}",
};
`;
};
