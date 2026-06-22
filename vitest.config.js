import { defineConfig } from 'vitest/config';

// Vitest config kept separate from vite.config.js so the React plugin (which
// pulls in the full browser/JSX toolchain) isn't required just to run the
// pure-logic gaze unit tests. esbuild transpiles the TypeScript sources.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts'],
  },
});
