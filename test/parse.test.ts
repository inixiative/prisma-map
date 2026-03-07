import { describe, expect, it } from 'bun:test';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPrismaMapV7 } from '../src/v7/build';
import { parseInlineSchema } from '../src/v7/inlineSchema';
import { parseEnumValues } from '../src/v7/parseEnumValues';
import { parseRelationFks } from '../src/v7/relationFks';
import { parseRuntimeDataModel } from '../src/v7/runtimeDataModel';
import { makeClassTs, makeFixtureDir } from './fixtures/v7';

// ─── parseRelationFks (pure function — no file IO) ────────────────────────────

describe('parseRelationFks', () => {
  it('parses basic @relation with fields and references', () => {
    const schema = `
model Post {
  id       String @id
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}

model User {
  id    String @id
  posts Post[]
}
`;
    const result = parseRelationFks(schema);

    expect(result.has('Post')).toBe(true);
    const postFks = result.get('Post')!;
    expect(postFks.has('author')).toBe(true);
    expect(postFks.get('author')).toEqual({ fields: ['authorId'], references: ['id'] });
  });

  it('back-relations are not included (no fields/references)', () => {
    const schema = `
model Post {
  id       String @id
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}

model User {
  id    String @id
  posts Post[]
}
`;
    const result = parseRelationFks(schema);
    // User.posts has no @relation annotation → not in result
    expect(result.has('User')).toBe(false);
  });

  it('parses named relation', () => {
    const schema = `
model Post {
  id       String @id
  editorId String
  editor   User   @relation("EditorRelation", fields: [editorId], references: [id])
}

model User {
  id           String @id
  editedPosts  Post[] @relation("EditorRelation")
}
`;
    const result = parseRelationFks(schema);
    const postFks = result.get('Post');
    expect(postFks?.get('editor')).toEqual({ fields: ['editorId'], references: ['id'] });
  });

  it('parses composite FK (multiple fields)', () => {
    const schema = `
model PostCategory {
  postId     String
  categoryId String
  post       Post     @relation(fields: [postId, categoryId], references: [id, catId])
}
`;
    const result = parseRelationFks(schema);
    const fks = result.get('PostCategory')?.get('post');
    expect(fks?.fields).toEqual(['postId', 'categoryId']);
    expect(fks?.references).toEqual(['id', 'catId']);
  });

  it('parses multiple relations in one model', () => {
    const schema = `
model Post {
  id       String @id
  authorId String
  editorId String
  author   User @relation("Author", fields: [authorId], references: [id])
  editor   User @relation("Editor", fields: [editorId], references: [id])
}
`;
    const result = parseRelationFks(schema);
    const postFks = result.get('Post')!;
    expect(postFks.size).toBe(2);
    expect(postFks.get('author')).toEqual({ fields: ['authorId'], references: ['id'] });
    expect(postFks.get('editor')).toEqual({ fields: ['editorId'], references: ['id'] });
  });

  it('parses multiple models', () => {
    const schema = `
model Post {
  id       String @id
  authorId String
  author   User @relation(fields: [authorId], references: [id])
}

model Comment {
  id     String @id
  postId String
  post   Post   @relation(fields: [postId], references: [id])
}

model User {
  id    String @id
  posts Post[]
}
`;
    const result = parseRelationFks(schema);
    expect(result.has('Post')).toBe(true);
    expect(result.has('Comment')).toBe(true);
    expect(result.has('User')).toBe(false);
  });

  it('returns empty map for schema with no @relation annotations', () => {
    const schema = `
model User {
  id    String @id
  name  String
  email String
}
`;
    const result = parseRelationFks(schema);
    expect(result.size).toBe(0);
  });

  it('handles optional and list relation field types', () => {
    const schema = `
model Post {
  id           String    @id
  categoryId   String?
  category     Category? @relation(fields: [categoryId], references: [id])
}
`;
    const result = parseRelationFks(schema);
    expect(result.get('Post')?.get('category')).toEqual({
      fields: ['categoryId'],
      references: ['id'],
    });
  });

  it('[P1] parses @relation when other attributes precede it on the same line', () => {
    // Prisma allows @ignore, @map, etc. before @relation
    const schema = `
model Post {
  id       String @id
  authorId String
  author   User   @ignore @relation(fields: [authorId], references: [id])
}
`;
    const result = parseRelationFks(schema);
    expect(result.get('Post')?.get('author')).toEqual({
      fields: ['authorId'],
      references: ['id'],
    });
  });

  it('[P1] parses @relation with reversed argument order (references before fields)', () => {
    const schema = `
model Post {
  id       String @id
  authorId String
  author   User   @relation(references: [id], fields: [authorId])
}
`;
    const result = parseRelationFks(schema);
    expect(result.get('Post')?.get('author')).toEqual({
      fields: ['authorId'],
      references: ['id'],
    });
  });

  it('[P2] parses model block with indented closing brace', () => {
    const schema = `
model Post {
  id       String @id
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
  }
`;
    const result = parseRelationFks(schema);
    expect(result.get('Post')?.get('author')).toEqual({
      fields: ['authorId'],
      references: ['id'],
    });
  });

  it('[P1] ignores commented-out @relation lines', () => {
    const schema = `
model User {
  id    String @id
  posts Post[]
  // posts Post[] @relation(fields: [id], references: [id])
}

model Post {
  id       String @id
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}
`;
    const result = parseRelationFks(schema);
    expect(result.has('User')).toBe(false);
    expect(result.get('Post')?.get('author')).toEqual({
      fields: ['authorId'],
      references: ['id'],
    });
  });
});

// ─── parseRuntimeDataModel + parseInlineSchema (fixture-based) ───────────────

describe('parseRuntimeDataModel', () => {
  it('extracts runtimeDataModel JSON', () => {
    const fixture = { models: { User: { fields: [], dbName: null } }, enums: {}, types: {} };
    const dir = makeFixtureDir();
    writeFileSync(join(dir, 'internal', 'class.ts'), makeClassTs(fixture, ''));

    try {
      const result = parseRuntimeDataModel(dir);
      expect(result.models).toHaveProperty('User');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('throws on missing runtimeDataModel', () => {
    const dir = makeFixtureDir();
    writeFileSync(join(dir, 'internal', 'class.ts'), '// nothing here');
    try {
      expect(() => parseRuntimeDataModel(dir)).toThrow('runtimeDataModel');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('handles encoded content containing escaped quote+paren sequence', () => {
    const runtimeDataModel = {
      models: {
        Weird: {
          dbName: 'abc\\")xyz',
          fields: [],
        },
      },
      enums: {},
      types: {},
    };
    const dir = makeFixtureDir();
    writeFileSync(join(dir, 'internal', 'class.ts'), makeClassTs(runtimeDataModel, ''));
    try {
      const result = parseRuntimeDataModel(dir);
      expect(result.models.Weird.dbName).toBe('abc\\")xyz');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('parseInlineSchema', () => {
  it('extracts inlineSchema text', () => {
    const dir = makeFixtureDir();
    const schema = 'model User {\n  id String @id\n}';
    writeFileSync(join(dir, 'internal', 'class.ts'), makeClassTs({}, schema));

    try {
      const result = parseInlineSchema(dir);
      expect(result).toContain('model User');
      expect(result).toContain('@id');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('throws on missing inlineSchema', () => {
    const dir = makeFixtureDir();
    writeFileSync(join(dir, 'internal', 'class.ts'), 'config.runtimeDataModel = JSON.parse("{}")');
    try {
      expect(() => parseInlineSchema(dir)).toThrow('inlineSchema');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('[P1] round-trips literal backslash+n (\\\\n) without corruption', () => {
    // Schema contains @default("\\n") where \\n is a literal backslash followed by n.
    // The sequential-replace approach corrupts this; JSON.parse handles it correctly.
    const schema = 'model User {\n  id String @id\n  val String @default("\\\\n")\n}';
    const dir = makeFixtureDir();
    writeFileSync(join(dir, 'internal', 'class.ts'), makeClassTs({}, schema));
    try {
      const result = parseInlineSchema(dir);
      expect(result).toContain('@default("\\\\n")');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

// ─── buildPrismaMapV7 end-to-end ─────────────────────────────────────────────

describe('buildPrismaMapV7', () => {
  it('[P2] end-to-end: builds PrismaMap with scalar and relation fields', () => {
    const runtimeDataModel = {
      models: {
        User: {
          dbName: null,
          fields: [
            {
              name: 'id',
              kind: 'scalar',
              type: 'String',
              isRequired: true,
              isList: false,
              isId: true,
            },
            {
              name: 'posts',
              kind: 'object',
              type: 'Post',
              isRequired: true,
              isList: true,
              relationName: null,
            },
          ],
        },
        Post: {
          dbName: null,
          fields: [
            {
              name: 'id',
              kind: 'scalar',
              type: 'String',
              isRequired: true,
              isList: false,
              isId: true,
            },
            {
              name: 'authorId',
              kind: 'scalar',
              type: 'String',
              isRequired: true,
              isList: false,
              isId: false,
            },
            {
              name: 'author',
              kind: 'object',
              type: 'User',
              isRequired: true,
              isList: false,
              relationName: null,
            },
          ],
        },
      },
      enums: {},
      types: {},
    };
    const inlineSchema = `
model User {
  id    String @id
  posts Post[]
}

model Post {
  id       String @id
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}
`;
    const dir = makeFixtureDir();
    writeFileSync(join(dir, 'internal', 'class.ts'), makeClassTs(runtimeDataModel, inlineSchema));

    try {
      const map = buildPrismaMapV7(dir);
      expect(map.User.fields.id).toMatchObject({ kind: 'scalar', type: 'String', isId: true });
      expect(map.User.fields.posts).toMatchObject({
        kind: 'object',
        type: 'Post',
        isList: true,
        fromFields: [],
        toFields: [],
      });
      expect(map.Post.fields.author).toMatchObject({
        kind: 'object',
        type: 'User',
        fromFields: ['authorId'],
        toFields: ['id'],
      });
      expect(map.Post.fields.authorId).toMatchObject({ kind: 'scalar', type: 'String' });
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('[P1] parseRelationFks: handles multi-line @relation args', () => {
    const schema = `
model Post {
  id       String @id
  authorId String
  author   User   @relation(
    fields: [authorId],
    references: [id],
    onDelete: Cascade
  )
}
`;
    const result = parseRelationFks(schema);
    expect(result.get('Post')?.get('author')).toEqual({
      fields: ['authorId'],
      references: ['id'],
    });
  });

  it('[P0] parseRuntimeDataModel round-trips escape sequences correctly', () => {
    // Ensures \\n, \\t, \\uXXXX etc. in dbName/field strings survive the decode
    const runtimeDataModel = {
      models: {
        MyModel: {
          dbName: 'my\\ntable', // literal backslash+n in table name
          fields: [
            {
              name: 'id',
              kind: 'scalar',
              type: 'String',
              isRequired: true,
              isList: false,
              isId: true,
            },
          ],
        },
      },
      enums: {},
      types: {},
    };
    const dir = makeFixtureDir();
    writeFileSync(join(dir, 'internal', 'class.ts'), makeClassTs(runtimeDataModel, ''));
    try {
      const result = parseRuntimeDataModel(dir);
      expect(result.models.MyModel.dbName).toBe('my\\ntable');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('builds enum fields with values from inlineSchema', () => {
    const runtimeDataModel = {
      models: {
        User: {
          dbName: null,
          fields: [
            {
              name: 'id',
              kind: 'scalar',
              type: 'String',
              isRequired: true,
              isList: false,
              isId: true,
            },
            {
              name: 'role',
              kind: 'enum',
              type: 'UserRole',
              isRequired: true,
              isList: false,
              isId: false,
            },
          ],
        },
      },
      enums: {},
      types: {},
    };
    const inlineSchema = `
enum UserRole {
  ADMIN
  USER
  GUEST
}

model User {
  id   String   @id
  role UserRole
}
`;
    const dir = makeFixtureDir();
    writeFileSync(join(dir, 'internal', 'class.ts'), makeClassTs(runtimeDataModel, inlineSchema));
    try {
      const map = buildPrismaMapV7(dir);
      const roleField = map.User.fields.role;
      expect(roleField.kind).toBe('enum');
      if (roleField.kind === 'enum') {
        expect(roleField.type).toBe('UserRole');
        expect(roleField.values).toEqual(['ADMIN', 'USER', 'GUEST']);
      }
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

// ─── parseEnumValues ─────────────────────────────────────────────────────────

describe('parseEnumValues', () => {
  it('parses basic enum values', () => {
    const schema = `
enum UserRole {
  ADMIN
  USER
  GUEST
}
`;
    const result = parseEnumValues(schema);
    expect(result.get('UserRole')).toEqual(['ADMIN', 'USER', 'GUEST']);
  });

  it('strips @map annotations from values', () => {
    const schema = `
enum Color {
  RED   @map("red")
  GREEN @map("green")
  BLUE
}
`;
    const result = parseEnumValues(schema);
    expect(result.get('Color')).toEqual(['RED', 'GREEN', 'BLUE']);
  });

  it('strips inline comments', () => {
    const schema = `
enum Status {
  ACTIVE   // currently active
  INACTIVE // no longer active
  PENDING  // awaiting approval
}
`;
    const result = parseEnumValues(schema);
    expect(result.get('Status')).toEqual(['ACTIVE', 'INACTIVE', 'PENDING']);
  });

  it('skips @@map block attributes', () => {
    const schema = `
enum Priority {
  LOW
  HIGH
  @@map("priority")
}
`;
    const result = parseEnumValues(schema);
    expect(result.get('Priority')).toEqual(['LOW', 'HIGH']);
  });

  it('parses multiple enums', () => {
    const schema = `
enum Role {
  ADMIN
  USER
}

enum Status {
  ACTIVE
  INACTIVE
}
`;
    const result = parseEnumValues(schema);
    expect(result.get('Role')).toEqual(['ADMIN', 'USER']);
    expect(result.get('Status')).toEqual(['ACTIVE', 'INACTIVE']);
  });

  it('returns empty map for schema with no enums', () => {
    const schema = `
model User {
  id String @id
}
`;
    const result = parseEnumValues(schema);
    expect(result.size).toBe(0);
  });

  it('handles indented enum declarations', () => {
    const schema = `
  enum Tier {
    FREE
    PRO
    ENTERPRISE
  }
`;
    const result = parseEnumValues(schema);
    expect(result.get('Tier')).toEqual(['FREE', 'PRO', 'ENTERPRISE']);
  });
});
