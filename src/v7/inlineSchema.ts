import { readGeneratedClient } from './readClient';

export const parseInlineSchema = (generatedClientPath: string): string => {
  const content = readGeneratedClient(generatedClientPath);

  const match = content.match(/"inlineSchema":\s*"(.+?)(?<!\\)",/s);
  if (!match) {
    throw new Error(
      `Could not extract inlineSchema from generated client at: ${generatedClientPath}`,
    );
  }

  // Use JSON.parse to correctly decode all JSON escape sequences in one pass.
  // Manual sequential replaces are order-sensitive and corrupt e.g. \\n (literal \+n).
  return JSON.parse(`"${match[1]}"`);
};
