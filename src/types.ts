export type ScalarField = {
  kind: 'scalar';
  type: string; // 'String' | 'Int' | 'Boolean' | 'DateTime' | 'Float' | 'BigInt' | 'Decimal' | 'Bytes' | 'Json'
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
};

export type EnumField = {
  kind: 'enum';
  type: string; // enum name, e.g. 'UserRole'
  isRequired: boolean;
  isList: boolean;
};

export type RelationField = {
  kind: 'object';
  type: string; // target model name, e.g. 'User'
  isList: boolean;
  isRequired: boolean;
  relationName?: string;
  fromFields: string[]; // FK fields on THIS model (empty [] for back-relations)
  toFields: string[]; // Referenced fields on target model (empty [] for back-relations)
};

export type ModelField = ScalarField | EnumField | RelationField;

export type ModelEntry = {
  dbName: string | null;
  fields: Record<string, ModelField>;
};

export type PrismaMap = Record<string, ModelEntry>;

// Internal parsing types — not exported from index

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
