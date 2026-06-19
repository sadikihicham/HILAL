import { defineConfig } from 'vitest/config';

// Tests de logique pure desktop (src/lib/compute.ts) en environnement node.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
