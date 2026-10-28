import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// API tests run against the Firebase emulators: `pnpm test:api`.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
