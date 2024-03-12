module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      './packages/apis/*/tsconfig.json',
      './packages/apps/*/tsconfig.json',
      './packages/clis/*/tsconfig.json',
      './packages/libs/*/tsconfig.json',
    ],
  },
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': 'warn',
  },
  ignorePatterns: ['*.d.ts'],
  plugins: ['@typescript-eslint'],
  root: true,
};
