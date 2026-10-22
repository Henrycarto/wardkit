import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/components\/wardkit\//, replacement: here('./registry/wardkit/components/') },
      { find: /^@\/lib\/wardkit\//, replacement: here('./registry/wardkit/lib/') },
      { find: /^@\//, replacement: here('./') },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
