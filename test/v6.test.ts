import { describe, it, expect } from 'bun:test';
import { parseSchemaText, buildFromSchemaFile } from '../src/v6/parse';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const makeTempDir = () => {
  const dir = join(tmpdir(), `prisma-map-v6-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

// ─── parseSchemaText ─────────────────────────────────────────────────────────

describe('parseSchemaText — scalar fields', () => {
  it('parses required and optional scalars', () => {
    const schema = `
model User {
  id    String  @id @default(cuid())
  name  String
  email String?
  age   Int?
}
`;
    const map = parseSchemaText(schema);
    expect(map.User.fields.id).toEqual({ kind: 'scalar', type: 'String', isRequired: true, isList: false, isId: true });
    expect(map.User.fields.name).toEqual({ kind: 'scalar', type: 'String', isRequired: true, isList: false, isId: false });
    expect(map.User.fields.email).toEqual({ kind: 'scalar', type: 'String', isRequired: false, isList: false, isId: false });
    expect(map.User.fields.age).toEqual({ kind: 'scalar', type: 'Int', isRequired: false, isList: false, isId: false });
  });

  it('parses list scalar fields', () => {
    const schema = `
model Post {
  id   String   @id
  tags String[]
}
`;
    const map = parseSchemaText(schema);
    expect(map.Post.fields.tags).toEqual({ kind: 'scalar', type: 'String', isRequired: true, isList: true, isId: false });
  });

  it('parses Json scalar type', () => {
    const schema = `
model User {
  id       String @id
  metadata Json?
}
`;
    const map = parseSchemaText(schema);
    expect(map.User.fields.metadata).toEqual({ kind: 'scalar', type: 'Json', isRequired: false, isList: false, isId: false });
  });

  it('parses DateTime scalar type', () => {
    const schema = `
model Post {
  id        String   @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
    const map = parseSchemaText(schema);
    expect(map.Post.fields.createdAt).toEqual({ kind: 'scalar', type: 'DateTime', isRequired: true, isList: false, isId: false });
  });
});

describe('parseSchemaText — relation fields', () => {
  it('parses forward relation with FK info', () => {
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
    const map = parseSchemaText(schema);
    expect(map.Post.fields.author).toEqual({
      kind: 'object',
      type: 'User',
      isList: false,
      isRequired: true,
      fromFields: ['authorId'],
      toFields: ['id'],
    });
  });

  it('parses back-relation with empty fromFields/toFields', () => {
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
    const map = parseSchemaText(schema);
    expect(map.User.fields.posts).toEqual({
      kind: 'object',
      type: 'Post',
      isList: true,
      isRequired: true,
      fromFields: [],
      toFields: [],
    });
  });

  it('parses optional relation', () => {
    const schema = `
model Post {
  id         String    @id
  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id])
}

model Category {
  id    String @id
  posts Post[]
}
`;
    const map = parseSchemaText(schema);
    expect(map.Post.fields.category).toMatchObject({
      kind: 'object',
      type: 'Category',
      isRequired: false,
      fromFields: ['categoryId'],
      toFields: ['id'],
    });
  });

  it('parses named relation', () => {
    const schema = `
model Post {
  id       String @id
  editorId String
  editor   User   @relation("EditorRelation", fields: [editorId], references: [id])
}

model User {
  id          String @id
  editedPosts Post[] @relation("EditorRelation")
}
`;
    const map = parseSchemaText(schema);
    expect(map.Post.fields.editor).toMatchObject({
      kind: 'object',
      type: 'User',
      fromFields: ['editorId'],
      toFields: ['id'],
    });
  });
});

describe('parseSchemaText — enum fields', () => {
  it('parses enum fields', () => {
    const schema = `
enum UserRole {
  ADMIN
  USER
  GUEST
}

model User {
  id   String   @id
  role UserRole @default(USER)
}
`;
    const map = parseSchemaText(schema);
    expect(map.User.fields.role).toEqual({ kind: 'enum', type: 'UserRole', isRequired: true, isList: false });
  });

  it('parses optional enum field', () => {
    const schema = `
enum Status {
  ACTIVE
  INACTIVE
}

model Post {
  id     String  @id
  status Status?
}
`;
    const map = parseSchemaText(schema);
    expect(map.Post.fields.status).toEqual({ kind: 'enum', type: 'Status', isRequired: false, isList: false });
  });
});

describe('parseSchemaText — model metadata', () => {
  it('parses dbName from @@map', () => {
    const schema = `
model User {
  id   String @id
  name String

  @@map("users")
}
`;
    const map = parseSchemaText(schema);
    expect(map.User.dbName).toBe('users');
  });

  it('sets dbName to null when no @@map', () => {
    const schema = `
model User {
  id   String @id
  name String
}
`;
    const map = parseSchemaText(schema);
    expect(map.User.dbName).toBeNull();
  });

  it('parses multiple models', () => {
    const schema = `
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
    const map = parseSchemaText(schema);
    expect(Object.keys(map)).toEqual(expect.arrayContaining(['User', 'Post']));
  });
});

// ─── parseSchemaText — compound PK ──────────────────────────────────────────

describe('parseSchemaText — compound PK (@@id)', () => {
  it('marks constituent fields isId: true', () => {
    const schema = `
model PostCategory {
  postId     String
  categoryId String
  note       String?

  @@id([postId, categoryId])
}
`;
    const map = parseSchemaText(schema);
    expect(map.PostCategory.fields.postId).toMatchObject({ kind: 'scalar', isId: true });
    expect(map.PostCategory.fields.categoryId).toMatchObject({ kind: 'scalar', isId: true });
    expect(map.PostCategory.fields.note).toMatchObject({ kind: 'scalar', isId: false });
  });

  it('single @id field still works alongside @@id-free models', () => {
    const schema = `
model User {
  id   String @id
  name String
}
`;
    const map = parseSchemaText(schema);
    expect(map.User.fields.id).toMatchObject({ kind: 'scalar', isId: true });
    expect(map.User.fields.name).toMatchObject({ kind: 'scalar', isId: false });
  });
});

// ─── buildFromSchemaFile ─────────────────────────────────────────────────────

describe('buildFromSchemaFile', () => {
  it('reads schema.prisma from directory and parses it', () => {
    const dir = makeTempDir();
    const schema = `
model User {
  id    String @id
  email String
  posts Post[]
}

model Post {
  id       String @id
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}
`;
    writeFileSync(join(dir, 'schema.prisma'), schema);

    try {
      const map = buildFromSchemaFile(dir);
      expect(map.User.fields.id).toMatchObject({ kind: 'scalar', isId: true });
      expect(map.Post.fields.author).toMatchObject({
        kind: 'object',
        type: 'User',
        fromFields: ['authorId'],
        toFields: ['id'],
      });
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('throws on missing schema.prisma', () => {
    const dir = makeTempDir();
    try {
      expect(() => buildFromSchemaFile(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
