// ─── Annotations (the `/// @tagClass(key: value)` DSL) ───────────────────────

// A single annotation value. Bare words and quoted strings both land as string.
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
  annotations?: Annotations;
};

export type EnumField = {
  kind: 'enum';
  type: string; // enum name, e.g. 'UserRole'
  isRequired: boolean;
  isList: boolean;
  values: string[]; // enum member names, e.g. ['ADMIN', 'USER', 'GUEST']
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

export type RelationFkMapping = {
  fields: string[];
  references: string[];
};
