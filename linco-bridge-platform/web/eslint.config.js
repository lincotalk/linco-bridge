import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueTsConfig from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'unpackage/**', 'scripts/**'],
  },
  eslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...vueTsConfig(),
  skipFormatting,
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
