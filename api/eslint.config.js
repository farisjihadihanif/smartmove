import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['node_modules/', 'uploads/', 'coverage/']),
  {
    files: ['**/*.js'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
]);
