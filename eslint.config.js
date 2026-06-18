import js from '@eslint/js'
import ts from 'typescript-eslint'

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['src/engine/**/*.ts', 'src/shared/**/*.ts'],
    rules: {
      // 引擎纪律：禁止依赖 UI 层、禁止非种子随机与真实时间
      'no-restricted-imports': ['error', { patterns: ['*vue*', '*pinia*', '@/ui/*'] }],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '引擎内必须使用种子化 RNG' },
        { object: 'Date', property: 'now', message: '引擎内禁止真实时间，使用游戏时钟' },
      ],
    },
  },
  { ignores: ['dist/**', 'node_modules/**', 'src-tauri/**'] },
)
