import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/src/tests/**/*.test.ts', 'client/src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'node',
    testTimeout: 15000,
  },
});
