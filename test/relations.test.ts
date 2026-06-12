import { describe, expect, it } from 'bun:test';
import { getRelations, relationForeignKey } from '../src/relations';
import type { PrismaMap, RelationField } from '../src/types';

const rel = (over: Partial<RelationField>): RelationField => ({
  kind: 'object',
  type: 'Other',
  isList: false,
  isRequired: true,
  fromFields: [],
  toFields: [],
  ...over,
});

describe('relationForeignKey', () => {
  it('returns null for back-relations (no FK fields)', () => {
    expect(relationForeignKey(rel({ fromFields: [], toFields: [] }))).toBeNull();
  });

  it('returns the bare field name for a single same-named pair', () => {
    expect(relationForeignKey(rel({ fromFields: ['id'], toFields: ['id'] }))).toBe('id');
  });

  it('returns a { referencedField: localField } map for a renamed FK', () => {
    expect(relationForeignKey(rel({ fromFields: ['organizationId'], toFields: ['id'] }))).toEqual({
      id: 'organizationId',
    });
  });

  it('returns a composite map for multi-column FKs', () => {
    expect(
      relationForeignKey(rel({ fromFields: ['aId', 'bId'], toFields: ['aKey', 'bKey'] })),
    ).toEqual({ aKey: 'aId', bKey: 'bId' });
  });

  it('returns null on mismatched lengths', () => {
    expect(relationForeignKey(rel({ fromFields: ['a'], toFields: ['x', 'y'] }))).toBeNull();
  });
});

describe('getRelations', () => {
  const map: PrismaMap = {
    Inquiry: {
      dbName: null,
      fields: {
        id: { kind: 'scalar', type: 'String', isRequired: true, isList: false, isId: true },
        organization: rel({
          type: 'Organization',
          fromFields: ['organizationId'],
          toFields: ['id'],
        }),
        parent: rel({
          type: 'Inquiry',
          fromFields: ['parentId'],
          toFields: ['id'],
          annotations: { tree: { parent: true } },
        }),
        children: rel({ type: 'Inquiry', isList: true }),
      },
    },
  };

  it('lists only object fields with collapsed foreign keys', () => {
    const relations = getRelations(map, 'Inquiry');
    expect(relations.map((r) => r.relationName)).toEqual(['organization', 'parent', 'children']);
    expect(relations.find((r) => r.relationName === 'organization')?.foreignKey).toEqual({
      id: 'organizationId',
    });
    expect(relations.find((r) => r.relationName === 'children')?.foreignKey).toBeNull();
  });

  it('carries annotations through to RelationInfo', () => {
    const parent = getRelations(map, 'Inquiry').find((r) => r.relationName === 'parent');
    expect(parent?.annotations).toEqual({ tree: { parent: true } });
  });

  it('throws on an unknown model', () => {
    expect(() => getRelations(map, 'Nope')).toThrow();
  });
});
