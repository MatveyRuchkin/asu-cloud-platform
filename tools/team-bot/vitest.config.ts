import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { pool: 'forks', maxWorkers: 1, testTimeout: 15000, hookTimeout: 30000 },
});
