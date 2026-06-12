import { parseTagClasses } from '../annotations';
import type { Annotations, IndexEntry, IndexKind } from '../types';

/**
 * Per-model structure carried by `///` doc comments: model-level annotations,
 * field-level annotations (by field name), and indexes (`@@index` / `@@unique` /
 * `@@id` / `@@fulltext`) with their own annotations.
 */
export type ModelStructure = {
  annotations?: Annotations;
  fields: Map<string, Annotations>;
  indexes: IndexEntry[];
};

const INDEX_KINDS: Record<string, IndexKind> = {
  index: 'index',
  unique: 'unique',
  id: 'id',
  fulltext: 'fulltext',
};

// Strip the leading `///` from each doc line and join — feed to parseTagClasses.
const docText = (lines: string[]): string =>
  lines.map((line) => line.replace(/^\s*\/\/\//, '').trim()).join('\n');

// Pull the column names out of an index's first `[...]` arg, dropping per-field
// modifiers like `(sort: Desc)` / `(length: 10)` — only the leading name is kept.
const parseIndexFields = (args: string): string[] => {
  const list = args.match(/\[([^\]]*)\]/);
  if (!list) return [];
  return list[1]
    .split(',')
    .map((part) => part.trim().match(/^\w+/)?.[0] ?? '')
    .filter(Boolean);
};

/**
 * Extract the doc-comment-bearing structure of every model from schema text.
 *
 * A run of `///` lines binds to whatever declaration immediately follows it (the
 * model header, a field, or an index attribute). A blank line or a plain `//`
 * comment breaks the binding.
 */
export const parseSchemaStructure = (schema: string): Map<string, ModelStructure> => {
  const result = new Map<string, ModelStructure>();

  // Capture optional leading `///` lines, the model name, and the body.
  // [^\S\n] is horizontal whitespace only, so the doc run stays adjacent to `model`.
  const modelRe =
    /((?:^[^\S\n]*\/\/\/[^\n]*\n)*)^[^\S\n]*model\s+(\w+)\s*\{([\s\S]*?)^[^\S\n]*\}/gm;

  for (const modelMatch of schema.matchAll(modelRe)) {
    const leadingDocs = modelMatch[1];
    const modelName = modelMatch[2];
    const body = modelMatch[3];

    const structure: ModelStructure = { fields: new Map(), indexes: [] };

    const modelAnno = parseTagClasses(leadingDocs);
    if (modelAnno) structure.annotations = modelAnno;

    let pending: string[] = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();

      if (!line) {
        pending = [];
        continue;
      }
      if (line.startsWith('///')) {
        pending.push(line);
        continue;
      }
      if (line.startsWith('//')) {
        pending = [];
        continue;
      }

      const anno = parseTagClasses(docText(pending));

      const indexMatch = line.match(/^@@(index|unique|id|fulltext)\s*\(([\s\S]*)\)\s*$/);
      if (indexMatch) {
        const entry: IndexEntry = {
          kind: INDEX_KINDS[indexMatch[1]],
          fields: parseIndexFields(indexMatch[2]),
        };
        const nameMatch =
          indexMatch[2].match(/\bname:\s*"([^"]+)"/) ?? indexMatch[2].match(/\bmap:\s*"([^"]+)"/);
        if (nameMatch) entry.name = nameMatch[1];
        if (anno) entry.annotations = anno;
        structure.indexes.push(entry);
        pending = [];
        continue;
      }
      if (line.startsWith('@@')) {
        pending = [];
        continue;
      }

      const fieldMatch = line.match(/^(\w+)\s+[A-Za-z_]/);
      if (fieldMatch && anno) structure.fields.set(fieldMatch[1], anno);
      pending = [];
    }

    result.set(modelName, structure);
  }

  return result;
};
