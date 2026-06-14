# @inixiative/prisma-map

Extract a structured, runtime-friendly model map from a Prisma generated client.

`@inixiative/prisma-map` builds a `PrismaMap` object that includes:
- Models and fields
- Field kinds (`scalar`, `enum`, `object`)
- Relation FK direction (`fromFields`, `toFields`)
- Model DB table name (`@@map`) as `dbName`
- Enum values (ordered)

It supports both Prisma client layouts:
- Prisma v7: parse generated `internal/class.ts`
- Prisma v6: parse generated `schema.prisma`

## Installation

```bash
bun add @inixiative/prisma-map
```

or

```bash
npm i @inixiative/prisma-map
```

## Quick Start

### Prisma v7

```ts
import { buildPrismaMapV7 } from '@inixiative/prisma-map';

const map = buildPrismaMapV7();
// or: buildPrismaMapV7('/absolute/path/to/generated/client')

console.log(map.User.fields.posts);
```

### Prisma v6

```ts
import { buildPrismaMapV6 } from '@inixiative/prisma-map';

const map = buildPrismaMapV6();
// or: buildPrismaMapV6('/absolute/path/to/generated/client')

console.log(map.Post.fields.author);
```

## Output Shape

The library returns:

```ts
type PrismaMap = Record<string, {
  dbName: string | null;
  fields: Record<string, ScalarField | EnumField | RelationField>;
}>;
```

### Scalar field

```json
{
  "kind": "scalar",
  "type": "String",
  "isRequired": true,
  "isList": false,
  "isId": false
}
```

### Enum field

```json
{
  "kind": "enum",
  "type": "UserRole",
  "isRequired": true,
  "isList": false,
  "values": ["ADMIN", "USER", "GUEST"]
}
```

### Relation field

```json
{
  "kind": "object",
  "type": "User",
  "isList": false,
  "isRequired": true,
  "relationName": "AuthoredPosts",
  "fromFields": ["authorId"],
  "toFields": ["id"]
}
```

`fromFields`/`toFields` are empty arrays on back-relations.

## Example End-to-End

Given:

```prisma
enum Role {
  ADMIN
  USER
}

model User {
  id    String @id
  role  Role
  posts Post[]

  @@map("users")
}

model Post {
  id       String @id
  authorId String
  author   User   @relation("AuthoredPosts", fields: [authorId], references: [id])
}
```

A representative map:

```json
{
  "User": {
    "dbName": "users",
    "fields": {
      "id": {
        "kind": "scalar",
        "type": "String",
        "isRequired": true,
        "isList": false,
        "isId": true
      },
      "role": {
        "kind": "enum",
        "type": "Role",
        "isRequired": true,
        "isList": false,
        "values": ["ADMIN", "USER"]
      },
      "posts": {
        "kind": "object",
        "type": "Post",
        "isList": true,
        "isRequired": true,
        "fromFields": [],
        "toFields": []
      }
    }
  },
  "Post": {
    "dbName": null,
    "fields": {
      "author": {
        "kind": "object",
        "type": "User",
        "isList": false,
        "isRequired": true,
        "relationName": "AuthoredPosts",
        "fromFields": ["authorId"],
        "toFields": ["id"]
      }
    }
  }
}
```

## API

Root exports:

```ts
import {
  buildPrismaMapV6,
  buildPrismaMapV7,
  getRelations,
  relationForeignKey,
  parseTagClasses,
  type PrismaMap,
  type ModelEntry,
  type ModelField,
  type ScalarField,
  type EnumField,
  type RelationField,
  type IndexEntry,
  type RelationInfo,
  type Identifier,
  type Annotations,
} from '@inixiative/prisma-map';
```

Version-specific exports:

```ts
import { buildPrismaMapV7, parseRuntimeDataModel, parseInlineSchema, parseRelationFks, parseEnumValues, parseSchemaStructure } from '@inixiative/prisma-map/v7';
import { buildPrismaMapV6, parseSchemaText, buildFromSchemaFile } from '@inixiative/prisma-map/v6';
```

## Relation Traversal

`getRelations(map, modelName)` lists a model's relation fields with their foreign
keys collapsed for lookup; `relationForeignKey(field)` does the collapse alone.

```ts
import { getRelations } from '@inixiative/prisma-map';

getRelations(map, 'Inquiry');
// [
//   { relationName: 'organization', targetModel: 'Organization', isList: false,
//     foreignKey: { id: 'organizationId' } },
//   { relationName: 'parent', targetModel: 'Inquiry', isList: false,
//     foreignKey: { id: 'parentId' }, annotations: { tree: { parent: true } } },
//   { relationName: 'children', targetModel: 'Inquiry', isList: true, foreignKey: null },
// ]
```

`foreignKey` is a bare field name for a single same-named pair, a
`{ referencedField: localField }` map otherwise, and `null` for back-relations.
Functions are string-keyed — wrap them with your generated `ModelName` types if
you want typed accessors.

## Annotation DSL (`/// @tagClass(key: value)`)

Prisma rejects custom attributes, but preserves `///` doc comments into the
generated client's `inlineSchema`. prisma-map parses a small, forward-looking DSL
out of those comments and records it — domain-agnostically — under `annotations`.

```prisma
model Category {
  id       String     @id
  parentId String?
  /// @tree(parent: true)
  parent   Category?  @relation("tree", fields: [parentId], references: [id])
  children Category[] @relation("tree")

  /// @search(fuzzy: true)
  @@index([name])
}
```

```ts
map.Category.fields.parent.annotations; // { tree: { parent: true } }
map.Category.indexes;
// [{ kind: 'index', fields: ['name'], annotations: { search: { fuzzy: true } } }]
```

- **Grammar:** `@<tagClass>(<key>: <value>, …)`; multiple tag classes per line allowed.
- **Values:** `true`/`false` → boolean, numerics → number, `"quoted"`/bare words → string, `[a, b]` → array.
- **Placement:** a `///` run binds to the declaration directly below it — a model, a field, or an index (`@@index` / `@@unique` / `@@id` / `@@fulltext`). A blank line or a plain `//` breaks the binding.
- prisma-map only records the bag; what a tag class *means* (e.g. `tree.parent` → "don't auto-recurse up this self-relation") is the consumer's to decide.

## Auto-Detection Behavior

If you omit the path, the library walks upward from `process.cwd()` and checks common generated client locations:

- `node_modules/.prisma/client`
- `node_modules/@prisma/client`
- `prisma/generated/client`
- `src/generated/client`
- `src/generated/prisma`
- `generated/client`

v7 detection requires `internal/class.ts`.
v6 detection requires `schema.prisma` and excludes directories that also have `internal/class.ts`.

## Practical Use Cases

- Build rule-engine metadata for JSON rules
- Resolve template/package dependency graphs via relation edges
- Generate guardrails (for example, "entity X must include relation Y")
- Build field-level introspection UIs

## Notes and Limits

- The output uses logical Prisma field names.
- Field-level DB aliases (`@map` on fields) are not emitted today.
- Model DB alias (`@@map`) is emitted as `dbName`.
- Native DB type annotations (for example `@db.Text`) are not emitted.
- `relationName` is included when available in Prisma runtime metadata.

## Development

```bash
bun run test
bun run typecheck
bun run check
bun run build
```

## License

MIT
