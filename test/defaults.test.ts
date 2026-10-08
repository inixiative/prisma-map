import { describe, expect, it } from 'bun:test';
import { matchDefaultAttribute } from '../src/schemaText';
import { parseSchemaText } from '../src/v6/parseSchemaText';
import { parseFieldModifiers } from '../src/v7/fieldModifiers';

describe('matchDefaultAttribute', () => {
  it('reads an enum member, string, number and boolean as literals', () => {
    expect(matchDefaultAttribute('@default(platform)')).toEqual({
      kind: 'literal',
      value: 'platform',
    });
    expect(matchDefaultAttribute('@default("a\\nb")')).toEqual({ kind: 'literal', value: 'a\nb' });
    expect(matchDefaultAttribute('@default(-1.5)')).toEqual({ kind: 'literal', value: -1.5 });
    expect(matchDefaultAttribute('@default(false)')).toEqual({ kind: 'literal', value: false });
  });

  it('reads list literals, empty or not', () => {
    expect(matchDefaultAttribute('@default([])')).toEqual({ kind: 'literal', value: [] });
    expect(matchDefaultAttribute('@default(["a", "b,c"])')).toEqual({
      kind: 'literal',
      value: ['a', 'b,c'],
    });
  });

  it('keeps functions the database or Prisma evaluates as generated', () => {
    expect(matchDefaultAttribute('@db.VarChar(36) @default(dbgenerated("uuidv7()"))')).toEqual({
      kind: 'generated',
      expression: 'dbgenerated("uuidv7()")',
    });
    expect(matchDefaultAttribute('@default(autoincrement())')).toEqual({
      kind: 'generated',
      expression: 'autoincrement()',
    });
  });

  it('reads a JSON string default as its literal text, parens inside strings included', () => {
    expect(matchDefaultAttribute('@default("{\\"a\\":\\")\\"}")')).toEqual({
      kind: 'literal',
      value: '{"a":")"}',
    });
  });

  it('is absent without @default', () => {
    expect(matchDefaultAttribute('@db.VarChar(36) @map("x")')).toBeUndefined();
  });
});

describe('field defaults through both parsers', () => {
  const schema = `
enum Resource {
  platform
  User
}

model Tag {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
  ownerModel Resource @default(platform)
  userId     String?  // was @default("x")
  names      String[] @default([])
}
`;

  it('v6 exposes each default on its field and none where the schema has none', () => {
    const fields = parseSchemaText(schema).Tag!.fields;
    expect(fields.ownerModel).toMatchObject({ default: { kind: 'literal', value: 'platform' } });
    expect(fields.names).toMatchObject({ default: { kind: 'literal', value: [] } });
    expect(fields.id).toMatchObject({
      default: { kind: 'generated', expression: 'dbgenerated("uuidv7()")' },
    });
    expect(fields.userId).not.toHaveProperty('default');
  });

  it('v7 field modifiers carry the same defaults', () => {
    const fields = parseFieldModifiers(schema).get('Tag')!;
    expect(fields.get('ownerModel')?.default).toEqual({ kind: 'literal', value: 'platform' });
    expect(fields.get('userId')?.default).toBeUndefined();
  });
});
