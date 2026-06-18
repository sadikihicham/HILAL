import { defineConfig } from 'vitest/config';

// Tests de logique pure uniquement (src/format.ts, src/battery.ts) — pas de
// composants React Native, donc node suffit (pas de jsdom ni de preset RN).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
