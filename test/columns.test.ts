import { describe, expect, it } from 'bun:test';
import { getColumns, pickColumns } from '../src/columns';
import type { PrismaMap } from '../src/types';

const map: PrismaMap = {
  User: {
    dbName: 'users',
    fields: {
      id: { kind: 'scalar', type: 'String', isRequired: true, isList: false, isId: true },
      role: { kind: 'enum', type: 'Role', isRequired: true, isList: false, values: ['ADMIN'] },
      posts: {
        kind: 'object',
        type: 'Post',
        isList: true,
        isRequired: true,
        fromFields: [],
        toFields: [],
      },
    },
  },
};

describe('getColumns', () => {
  it('lists scalar and enum fields, not relations', () => {
    expect(getColumns(map, 'User')).toEqual(['id', 'role']);
  });

  it('throws for an unknown model', () => {
    expect(() => getColumns(map, 'Nope')).toThrow('Model Nope not found in PrismaMap');
  });
});

describe('pickColumns', () => {
  it('drops included relations and unknown keys', () => {
    const row = { id: 'u1', role: 'ADMIN', posts: [{ id: 'p1' }], _count: { posts: 1 } };
    expect(pickColumns(map, 'User', row)).toEqual({ id: 'u1', role: 'ADMIN' });
  });
});
