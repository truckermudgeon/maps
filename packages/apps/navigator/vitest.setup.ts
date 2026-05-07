// Use the default `@testing-library/jest-dom` entry (rather than
// `/vitest`) because `@types/jest` is hoisted into this monorepo
// from sibling CLI packages, so global `expect()` is typed as
// Jest's. The default entry augments `jest.Matchers`, which is
// what tsc actually sees here. Runtime registration works either
// way — both entries call `expect.extend(matchers)`.
import '@testing-library/jest-dom';
