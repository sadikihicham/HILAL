import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Tests de logique pure desktop (src/lib/compute.ts) en environnement node.
// L'alias `@shared` doit être résolu aussi ici (compute.ts importe @shared/format).
export default defineConfig({
  resolve: { alias: { '@shared': resolve(import.meta.dirname, '../src') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
