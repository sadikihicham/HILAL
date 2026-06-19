import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config Vite pour HILAL Desktop (frontend du shell Tauri).
// Projet 100% autonome : aucun import hors de desktop/ (isolation de build CI).
export default defineConfig({
  plugins: [react()],
  clearScreen: false, // ne pas masquer les logs Tauri
  server: {
    port: 1420,
    strictPort: true,
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
