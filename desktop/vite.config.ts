import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Config Vite pour HILAL Desktop (frontend du shell Tauri).
// `@shared` pointe vers le `src/` de l'app mobile HILAL : on y réutilise
// `theme.ts` et `format.ts` (TS pur, sans dépendance React Native).
export default defineConfig({
  plugins: [react()],
  clearScreen: false, // ne pas masquer les logs Tauri
  resolve: {
    alias: { '@shared': resolve(import.meta.dirname, '../src') },
  },
  server: {
    port: 1420,
    strictPort: true,
    // Autorise Vite à servir les fichiers partagés situés hors de `desktop/`.
    fs: { allow: ['..'] },
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
