import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import globals from 'globals'

// Общая конфигурация ESLint для frontend. Правила описаны в
// docs/architecture/decisions.md (ADR-010).
export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...vueTsEslintConfig(),
  skipFormatting,
  {
    name: 'app/language-options',
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    name: 'app/rules',
    rules: {
      // Название компонента-заглушки однословное — так его проще заменить страницами FE-02…FE-04.
      'vue/multi-word-component-names': 'off',
    },
  },
]
