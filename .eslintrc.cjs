module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  env: {
    browser: true,
    es2022: true,
    jest: true,
  },
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['src/**/*.ts'],
      excludedFiles: ['src/**/types.ts', 'src/**/*Types.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'TSInterfaceDeclaration',
            message: 'Declare interfaces in a dedicated types.ts or *Types.ts contract file.',
          },
        ],
      },
    },
  ],
};
