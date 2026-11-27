import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Runic Origami & Ink - pure client-side tower defense.
// Single canvas (960x600 logical), zero external assets, zero backend.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3000, host: true, strictPort: true },
  preview: { port: 4173, host: true, strictPort: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    assetsInlineLimit: 0,
  },
});
