import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as main from '../src/index';
import * as runtime from '../src/runtime';

describe('runtime entry', () => {
  it('exports every reader the main entry has, and no builders', () => {
    const builders = ['buildPrismaMapV6', 'buildPrismaMapV7'];
    const readers = Object.keys(main)
      .filter((k) => !builders.includes(k))
      .sort();
    expect(Object.keys(runtime).sort()).toEqual(readers);
  });

  it('imports no Node built-ins, so a browser can bundle it', () => {
    const files = ['runtime.ts', 'annotations.ts', 'columns.ts', 'identifiers.ts', 'relations.ts'];
    for (const f of files) {
      const src = readFileSync(join(import.meta.dir, '../src', f), 'utf8');
      expect(src).not.toMatch(/from ['"](node:)?(fs|path)['"]/);
    }
  });
});
