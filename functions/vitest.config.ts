import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: '.',
  esbuild: {
    tsconfigRaw: { compilerOptions: { target: 'ES2022', module: 'ESNext' } }
  },
  test: { include: ['src/**/*.spec.ts'] }
})
