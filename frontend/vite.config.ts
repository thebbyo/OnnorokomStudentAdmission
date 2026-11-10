/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // macOS AppleDouble files (._foo.test.ts) appear on exFAT drives; never collect them.
    exclude: ['**/._*', '**/node_modules/**', '**/dist/**'],
  },
});
