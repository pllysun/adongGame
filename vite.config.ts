/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // 覆盖率聚焦"逻辑"：引擎 + 共享类型/工具 + AI 内核。UI(.vue)与无头运行器/main 是表现/脚本层，不计入分母。
      include: ['src/engine/**', 'src/shared/**'],
      exclude: ['**/*.d.ts'],
      reporter: ['text-summary', 'text'],
      // 引擎逻辑覆盖率门槛：行/语句/函数 >95%。分支含大量防御性 ?? / 可选链回退，实际 ~87%。
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 85 },
    },
  },
})
