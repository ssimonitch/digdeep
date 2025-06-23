/// <reference types="vitest" />
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
