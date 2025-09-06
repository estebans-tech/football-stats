import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  eslintConfigPrettier
]