import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { routeHeadsPlugin } from './scripts/routeHeadsPlugin';

export default defineConfig({
  plugins: [react(), routeHeadsPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // Sims are lazy-loaded per module; keep the vendor core in one stable chunk
    // so navigating between modules only ever fetches the new sim.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          katex: ['katex'],
        },
      },
    },
  },
});
