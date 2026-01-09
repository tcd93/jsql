import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  {
    ignores: [
      // Build outputs
      'dist/**',
      'build/**',
      
      // Dependencies
      'node_modules/**',
      
      // Generated files
      '*.d.ts',
      
      // VS Code specific
      '.vscode/**',
      
      // OS files
      '.DS_Store',
      'Thumbs.db',
      
      // JavaScript files (we're linting TypeScript only)
      '*.js'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
    rules: {
      // React specific rules
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-pascal-case': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      'react/self-closing-comp': 'error',
      'react/no-array-index-key': 'error',
      'react/no-danger': 'error',
      'react/no-deprecated': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-unused-state': 'error',
      'react/prefer-stateless-function': 'error',
      'react/no-unescaped-entities': 'error',
      'react/display-name': 'error',
      
      // React Hooks rules
      ...reactHooks.configs.recommended.rules,
      
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/consistent-indexed-object-style': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      
      // Import rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index'
          ],
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'error',
      'import/no-unused-modules': 'error',
      
      // General rules
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': 'error',
      'no-case-declarations': 'error',
      'no-unused-expressions': 'error',
      'no-duplicate-imports': 'error',
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'prefer-arrow-callback': 'error',
      'arrow-spacing': 'error',
      
      // Accessibility rules
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
    },
  }
);
