// ─── Annotations (the `/// @tagClass(key: value)` DSL) ───────────────────────

// A single annotation value. Bare words and quoted strings both land as string.
declare const dbBrand: unique symbol;

/**
 * A physical DB identifier (table or column), resolved through `@@map`/`@map`.
 *
 * Branded so a SQL builder can accept ONLY resolved identifiers: a raw Prisma
 * field name is a `string` and will not satisfy it. Both surfaces are strings,
 * so without this the two are freely interchangeable and a mix-up produces
 * valid SQL that matches nothing. Produced by `tableName` / `columnName`.
 */
export type DbIdentifier = string & { readonly [dbBrand]: 'identifier' };

/**
 * A stored DB value for an enum member, resolved through `@map` on the member.
 * Branded for the same reason — `'SOCIAL_POST'` and `'Social Post'` are both
 * strings, and only one of them matches a row. Produced by `storedValue`.
 */
export type DbValue = string & { readonly [dbBrand]: 'value' };

export type AnnoValue = string | number | boolean | Array<string | number | boolean>;

// Parsed annotations, grouped by tag class: `@tree(parent: true)` →
// `{ tree: { parent: true } }`. prisma-map stays domain-agnostic — it only
// records the bag; consumers decide what a tag class means.
export type Annotations = Record<string, Record<string, AnnoValue>>;

// ─── Fields ───────────────────────────────────────────────────────────────────

export type ScalarField = {
  kind: 'scalar';
  type: string; // 'String' | 'Int' | 'Boolean' | 'DateTime' | 'Float' | 'BigInt' | 'Decimal' | 'Bytes' | 'Json'
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  dbName?: string; // column name from `@map("...")`; absent = field name IS the column
  annotations?: Annotations;
};

export type EnumField = {
  kind: 'enum';
  type: string; // enum name, e.g. 'UserRole'
  isRequired: boolean;
  isList: boolean;
  values: string[]; // enum member names, e.g. ['ADMIN', 'USER', 'GUEST']
  dbName?: string; // COLUMN name from `@map("...")`; absent = field name IS the column
  // Stored DB VALUES from `@map("...")` on enum members, keyed by member name.
  // Sparse — absent entry means the member name IS the stored value. Distinct
  // from `dbName` above, which renames the column, not its contents.
  valueDbNames?: Record<string, string>;
  annotations?: Annotations;
};

export type RelationField = {
  kind: 'object';
  type: string; // target model name, e.g. 'User'
  isList: boolean;
  isRequired: boolean;
  relationName?: string;
  fromFields: string[]; // FK fields on THIS model (empty [] for back-relations)
  toFields: string[]; // Referenced fields on target model (empty [] for back-relations)
  annotations?: Annotations;
};

export type ModelField = ScalarField | EnumField | RelationField;

// ─── Indexes (`@@index` / `@@unique` / `@@id` / `@@fulltext`) ─────────────────

export type IndexKind = 'index' | 'unique' | 'id' | 'fulltext';

export type IndexEntry = {
  kind: IndexKind;
  fields: string[]; // the indexed columns, in declared order
  name?: string; // explicit `name:` / `map:` if given
  annotations?: Annotations;
};

// ─── Models / Map ─────────────────────────────────────────────────────────────

export type ModelEntry = {
  dbName: string | null;
  fields: Record<string, ModelField>;
  indexes?: IndexEntry[];
  annotations?: Annotations;
};

export type PrismaMap = Record<string, ModelEntry>;

// ─── Relation traversal ───────────────────────────────────────────────────────

// A foreign key collapsed for lookup: a single same-named pair is the bare field
// name; otherwise a `{ referencedField: localField }` map. `null` for back-relations.
export type Identifier = string | Record<string, string>;

export type RelationInfo = {
  relationName: string;
  targetModel: string;
  isList: boolean;
  foreignKey: Identifier | null;
  annotations?: Annotations;
};

// ─── Internal parsing types — not exported from index ─────────────────────────

export type RuntimeField = {
  name: string;
  kind: 'scalar' | 'object' | 'enum';
  type: string;
  relationName?: string;
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
};

export type RuntimeModel = {
  fields: RuntimeField[];
  dbName: string | null;
};

export type RuntimeDataModel = {
  models: Record<string, RuntimeModel>;
  enums: Record<string, unknown>;
  types: Record<string, unknown>;
};

export type EnumValues = {
  values: string[]; // member names, in declared order
  dbNames?: Record<string, string>; // member name -> stored DB value, for members with `@map`
};

export type RelationFkMapping = {
  fields: string[];
  references: string[];
};
