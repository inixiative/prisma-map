import { describe, expect, it } from 'bun:test';
import { columnName, storedValue, tableName } from '../src/identifiers';
import type { EnumField, ScalarField } from '../src/types';
import { parseSchemaText } from '../src/v6/parseSchemaText';
import { parseFieldModifiers } from '../src/v7/fieldModifiers';

// Regression suite for the adversarial pass. Every case below produced silently
// WRONG output before the shared, string-literal-aware comment stripper.
// Ground truth throughout is Prisma's own DMMF.

describe('comments must not be read as attributes', () => {
  it('D1 — a comment mentioning @map does not invent a column (v6)', () => {
    const map = parseSchemaText(`
model Account {
  id       String @id
  username String
  email    String // legacy rows stored this under @map("username"); migrated 2024-01
}
`);
    expect(map.Account.fields.email).not.toHaveProperty('dbName');
    const column: string = columnName(map.Account.fields.email as ScalarField, 'email');
    expect(column).toBe('email'); // was 'username' — a real, wrong column
  });

  it('D1 — same for the v7 modifier pass', () => {
    const mods = parseFieldModifiers(`
model Account {
  email String // was @map("username")
}
`);
    expect(mods.get('Account')?.get('email')?.dbName).toBeUndefined();
  });

  it('D2 — `//` inside a @map value is not treated as a comment', () => {
    const map = parseSchemaText(`
enum PathKind {
  ROOT   @map("a//b")
  NESTED @map("c")
}

model Node {
  id   String   @id
  kind PathKind
}
`);
    const field = map.Node.fields.kind as EnumField;
    expect(field.valueDbNames).toEqual({ ROOT: 'a//b', NESTED: 'c' });
    expect(storedValue(field, 'ROOT') as string).toBe('a//b');
  });

  it('D3 — escaped quotes inside @map are unescaped, not dropped', () => {
    const map = parseSchemaText(`
model Weird {
  id   String @id
  name String @map("we\\"ird")
}
`);
    const column: string = columnName(map.Weird.fields.name as ScalarField, 'name');
    expect(column).toBe('we"ird');
  });

  it('D4 — a commented-out @@map does not beat the real one', () => {
    const map = parseSchemaText(`
model User {
  id   String @id
  name String @map("new_name")

  // was @@map("legacy_user")
  @@map("users")
}
`);
    expect(map.User.dbName).toBe('users'); // was 'legacy_user'
    const table: string = tableName(map.User, 'User');
    expect(table).toBe('users');
  });

  it('D4 — a commented @@map alone does not fabricate a table', () => {
    const map = parseSchemaText(`
model Plain {
  id String @id
  // @@map("not_real")
}
`);
    expect(map.Plain.dbName).toBeNull();
    expect(tableName(map.Plain, 'Plain') as string).toBe('Plain');
  });

  it('D5 — CRLF schemas strip comments correctly', () => {
    // A `///` doc line under CRLF is the actual reproduction: the old
    // `/\/\/.*$/` never fired (no `m` flag, `.` does not match `\r`), so the
    // whole doc line survived and its first token became a phantom member.
    const map = parseSchemaText(
      'enum Tier {\r\n  /// the free tier\r\n  FREE\r\n  PRO\r\n}\r\n\r\nmodel Sub {\r\n  id   String @id\r\n  tier Tier\r\n}\r\n',
    );
    const field = map.Sub.fields.tier as EnumField;
    expect(field.values).toEqual(['FREE', 'PRO']); // was ['///', 'FREE', 'PRO']
  });

  it('D6 — a comment mentioning @id does not mark the field as an id', () => {
    const map = parseSchemaText(`
model Note {
  id   String @id
  body String // not the @id anymore
}
`);
    expect((map.Note.fields.body as ScalarField).isId).toBe(false);
  });

  it('keeps real attributes that merely sit next to comments', () => {
    const map = parseSchemaText(`
model Mixed {
  id        String   @id
  createdAt DateTime @map("created_at") // real rename, keep it
}
`);
    expect(columnName(map.Mixed.fields.createdAt as ScalarField, 'createdAt') as string).toBe(
      'created_at',
    );
  });
});

describe('@map attribute forms Prisma accepts', () => {
  it('matches spaced and named forms, not just the tight one', () => {
    const map = parseSchemaText(`
model Spaced {
  id   String @id
  a    String @map( "a_col" )
  b    String @map(name: "b_col")
  c    String @map( name:  "c_col" )
  d    String @map("d_col")
}
`);
    const col = (f: string) => columnName(map.Spaced.fields[f] as ScalarField, f) as string;
    expect([col('a'), col('b'), col('c'), col('d')]).toEqual(['a_col', 'b_col', 'c_col', 'd_col']);
  });

  it('matches spaced and named forms for @@map too', () => {
    expect(parseSchemaText('model A {\n  id String @id\n  @@map( "a_tbl" )\n}').A.dbName).toBe(
      'a_tbl',
    );
    expect(parseSchemaText('model B {\n  id String @id\n  @@map(name: "b_tbl")\n}').B.dbName).toBe(
      'b_tbl',
    );
  });

  it('does not let a field-level match pick up a model-level @@map', () => {
    const map = parseSchemaText(`
model Sneaky {
  id String @id
  @@map("sneaky_tbl")
}
`);
    expect(map.Sneaky.fields.id).not.toHaveProperty('dbName');
    expect(map.Sneaky.dbName).toBe('sneaky_tbl');
  });

  it('decodes escape sequences the way Prisma does', () => {
    const map = parseSchemaText(`
model Esc {
  id String @id
  a  String @map("a\\nb")
  b  String @map("a\\tb")
  c  String @map("a\\u0041b")
  d  String @map("a\\\\")
}
`);
    const col = (f: string) => columnName(map.Esc.fields[f] as ScalarField, f) as string;
    expect(col('a')).toBe('a\nb');
    expect(col('b')).toBe('a\tb');
    expect(col('c')).toBe('aAb');
    expect(col('d')).toBe('a\\');
  });

  it('treats @map("") as present, not absent', () => {
    const map = parseSchemaText('model E {\n  id String @id\n  a String @map("")\n}');
    expect((map.E.fields.a as ScalarField).dbName).toBe('');
  });
});
