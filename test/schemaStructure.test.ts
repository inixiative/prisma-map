import { describe, expect, it } from 'bun:test';
import { parseSchemaStructure } from '../src/v7/schemaStructure';

describe('parseSchemaStructure', () => {
  it('binds a /// annotation to the field directly below it', () => {
    const schema = `
model Category {
  id       String    @id
  parentId String?
  /// @tree(parent: true)
  parent   Category? @relation("tree", fields: [parentId], references: [id])
  children Category[] @relation("tree")
}
`;
    const structure = parseSchemaStructure(schema);
    const category = structure.get('Category');
    expect(category?.fields.get('parent')).toEqual({ tree: { parent: true } });
    // back-relation has no annotation
    expect(category?.fields.get('children')).toBeUndefined();
  });

  it('binds /// above the model to model-level annotations', () => {
    const schema = `
/// @domain(area: auth)
model Session {
  id String @id
}
`;
    expect(parseSchemaStructure(schema).get('Session')?.annotations).toEqual({
      domain: { area: 'auth' },
    });
  });

  it('parses indexes and binds /// above an index', () => {
    const schema = `
model Article {
  id     String @id
  title  String
  author String

  /// @search(fuzzy: true)
  @@index([title, author], name: "article_title_idx")
  @@unique([title])
}
`;
    const article = parseSchemaStructure(schema).get('Article');
    expect(article?.indexes).toEqual([
      {
        kind: 'index',
        fields: ['title', 'author'],
        name: 'article_title_idx',
        annotations: { search: { fuzzy: true } },
      },
      { kind: 'unique', fields: ['title'] },
    ]);
  });

  it('breaks the binding on a blank line or a plain // comment', () => {
    const schema = `
model Thing {
  id String @id

  /// @tree(parent: true)

  parent Thing? @relation(fields: [pid], references: [id])
  pid    String?

  /// @tree(root: true)
  // plain comment intervenes
  other  String
}
`;
    const thing = parseSchemaStructure(schema).get('Thing');
    expect(thing?.fields.get('parent')).toBeUndefined();
    expect(thing?.fields.get('other')).toBeUndefined();
  });

  it('handles @@id and @@fulltext index kinds', () => {
    const schema = `
model Pair {
  a String
  b String
  @@id([a, b])
  @@fulltext([a])
}
`;
    const pair = parseSchemaStructure(schema).get('Pair');
    expect(pair?.indexes).toEqual([
      { kind: 'id', fields: ['a', 'b'] },
      { kind: 'fulltext', fields: ['a'] },
    ]);
  });
});
