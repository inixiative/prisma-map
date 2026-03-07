import type { RuntimeDataModel } from '../types';
import { readGeneratedClient } from './readClient';

export const parseRuntimeDataModel = (generatedClientPath: string): RuntimeDataModel => {
  const content = readGeneratedClient(generatedClientPath);

  const match = content.match(/config\.runtimeDataModel\s*=\s*JSON\.parse\("(.+?)"\)/s);
  if (!match) {
    throw new Error(
      `Could not extract runtimeDataModel from generated client at: ${generatedClientPath}\n` +
        `Ensure this is a Prisma v7 generated client directory (contains internal/class.ts).`,
    );
  }

  // Use JSON.parse to decode the outer string layer, then parse the inner JSON.
  // Manual sequential replaces corrupt escape sequences like \n, \t, \uXXXX.
  const jsonString = JSON.parse(`"${match[1]}"`);
  return JSON.parse(jsonString) as RuntimeDataModel;
};
