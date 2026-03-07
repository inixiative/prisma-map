import type { RuntimeDataModel } from '../types';
import { readGeneratedClient } from './readClient';

const extractRuntimeDataModelString = (content: string): string | null => {
  const assignmentStart = content.search(/config\.runtimeDataModel\s*=\s*JSON\.parse\s*\(/);
  if (assignmentStart < 0) return null;

  const openParen = content.indexOf('(', assignmentStart);
  if (openParen < 0) return null;

  let i = openParen + 1;
  while (i < content.length && /\s/.test(content[i])) i++;
  if (content[i] !== '"') return null;
  i += 1;

  let escaped = false;
  const chars: string[] = [];
  while (i < content.length) {
    const ch = content[i];
    if (escaped) {
      chars.push(ch);
      escaped = false;
    } else if (ch === '\\') {
      chars.push(ch);
      escaped = true;
    } else if (ch === '"') {
      return chars.join('');
    } else {
      chars.push(ch);
    }
    i += 1;
  }

  return null;
};

export const parseRuntimeDataModel = (generatedClientPath: string): RuntimeDataModel => {
  const content = readGeneratedClient(generatedClientPath);

  const encoded = extractRuntimeDataModelString(content);
  if (!encoded) {
    throw new Error(
      `Could not extract runtimeDataModel from generated client at: ${generatedClientPath}\n` +
        `Ensure this is a Prisma v7 generated client directory (contains internal/class.ts).`,
    );
  }

  // Use JSON.parse to decode the outer string layer, then parse the inner JSON.
  // Manual sequential replaces corrupt escape sequences like \n, \t, \uXXXX.
  const jsonString = JSON.parse(`"${encoded}"`);
  return JSON.parse(jsonString) as RuntimeDataModel;
};
