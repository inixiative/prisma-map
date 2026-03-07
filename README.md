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
  type PrismaMap,
  type ModelEntry,
  type ModelField,
  type ScalarField,
  type EnumField,
  type RelationField,
} from '@inixiative/prisma-map';
```

Version-specific exports:

```ts
import { buildPrismaMapV7, parseRuntimeDataModel, parseInlineSchema, parseRelationFks, parseEnumValues } from '@inixiative/prisma-map/v7';
import { buildPrismaMapV6, parseSchemaText, buildFromSchemaFile } from '@inixiative/prisma-map/v6';
```

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
