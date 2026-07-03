import { node } from '@inixiative/config/tsup';

export default node({
  entry: ['src/index.ts', 'src/v7/index.ts', 'src/v6/index.ts'],
  minify: true,
  treeshake: true,
  platform: 'node',
});
