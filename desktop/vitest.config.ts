import { defineConfig } from 'vitest/config';

// Deux familles de tests cohabitent :
//   - logique pure (`tests/*.test.ts`) en environnement `node`, c'est le défaut ;
//   - rendu de composants (`tests/*.test.tsx`) en `jsdom`, déclaré par le
//     docblock `// @vitest-environment jsdom` en tête de fichier.
// Le motif `include` DOIT couvrir .tsx : avec `*.test.ts` seul, les tests
// d'interface seraient silencieusement ignorés — une suite verte qui ne teste rien.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
