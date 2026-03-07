import { describe, it, expect } from 'bun:test';
import { parseRelationFks, parseRuntimeDataModel, parseInlineSchema } from '../src/v7/parse';
import { writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { makeFixtureDir, makeClassTs } from './fixtures/v7';

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
});
