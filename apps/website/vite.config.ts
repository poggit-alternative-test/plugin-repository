import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/plugin-repository/',
  plugins: [
    react(),
    {
      name: 'copy-index-to-404',
      closeBundle() {
        // GitHub Pages needs 404.html to handle SPA routing
        if (existsSync('dist/index.html')) {
          copyFileSync('dist/index.html', 'dist/404.html');
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
