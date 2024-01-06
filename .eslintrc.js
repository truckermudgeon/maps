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
      './packages/clis/*/tsconfig.json',
      './packages/libs/*/tsconfig.json',
      './packages/apps/*/tsconfig.json',
    ],
  },
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    // TODO remove these entries
    '@typescript-eslint/no-explicit-any': ['off'],
    '@typescript-eslint/no-unsafe-argument': ['off'],
    '@typescript-eslint/no-unsafe-assignment': ['off'],
    '@typescript-eslint/no-unsafe-call': ['off'],
    '@typescript-eslint/no-unsafe-member-access': ['off'],
    '@typescript-eslint/no-unsafe-return': ['off'],
    '@typescript-eslint/no-unused-vars': ['warn'],
  },
  ignorePatterns: ['*.d.ts'],
  plugins: ['@typescript-eslint'],
  root: true,
};
