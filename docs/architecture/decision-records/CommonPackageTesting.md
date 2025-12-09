# Common Package Testing Framework

## Context

The `common` package contains shared utilities, types, and business logic used across the CAMS frontend, backend, and test suites. When the project initially set up npm workspaces, the `common` package was configured to use Jest for testing.

However, the BDD full-stack testing suite (in `test/bdd`) was already configured to run all `common` tests using Vitest as part of its comprehensive testing strategy. This created several issues:

1. **Duplicate test infrastructure** - The same test files were being run by both Jest (via `npm test` in common) and Vitest (via the BDD suite)
2. **Jest-specific workspace issues** - Jest has strict preset resolution requirements that don't work well with npm workspaces' dependency hoisting, requiring workarounds like installing dependencies locally with `--no-workspaces`
3. **Maintenance burden** - Two test frameworks meant two configurations to maintain and potential inconsistencies between test runs
4. **Inconsistent developer experience** - Tests might pass with one framework but fail with the other due to subtle differences

The BDD test suite's `vitest.config.ts` explicitly includes:
```typescript
include: ['test/bdd/features/**/*.spec.{ts,tsx}', 'common/**/*.test.{ts,tsx}']
```

This means the BDD suite was already designed to be the single source of truth for running `common` tests, making Jest redundant.

## Decision

We migrated the `common` package from Jest to Vitest to align with the BDD testing architecture and eliminate duplicate test infrastructure.

### Why Vitest?

- **Already in use** - The BDD suite runs `common` tests with Vitest
- **Better workspace support** - Vitest doesn't have the preset resolution issues that plague Jest in npm workspaces
- **Modern ESM support** - Better handling of ES modules, which `common` uses (`"type": "module"`)
- **Faster** - Vite's transformer is significantly faster than Jest's ts-jest
- **Compatible API** - Tests required minimal changes (just changing imports from `jest` to `vi`)

## Status

Accepted

## Consequences

### Positive

- **Single source of truth** - `common` tests now run consistently whether executed directly or via the BDD suite
- **Eliminated workspace issues** - No more `--no-workspaces` workarounds or manual dependency copying
- **Reduced maintenance** - One test configuration instead of two
- **Faster tests** - Vitest's transform layer is more performant than ts-jest
- **Consistency** - All frontend and shared code now uses Vitest (frontend uses Vitest via `FrontendBuildTooling.md`, BDD uses Vitest)

### Neutral

- **Backend still uses Jest** - The backend continues to use Jest, which is appropriate given its different architecture and dependencies (Azure Functions, Express)

## Related Decisions

- **FrontendBuildTooling.md** - Established Vitest for frontend testing
- **BddFullStackTesting.md** - Designed BDD suite to run `common` tests with Vitest
