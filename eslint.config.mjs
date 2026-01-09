import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  {
    ignores: [
      // Build outputs
      'out/**',
      'dist/**',
      
      // Dependencies
      'node_modules/**',
      
      // Generated files
      '*.d.ts',
      
      // Webview project (has its own eslint config)
      'webview/**',
      
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
  {
    files: ['src/**/*.ts'],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    settings: {
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
      
      // VS Code extension specific
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'Use vscode.env instead of process in VS Code extensions'
        }
      ]
    },
  }
);
