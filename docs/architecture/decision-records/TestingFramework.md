# Testing Framework Migration to Vitest

## Context

The CAMS project previously used Jest as the testing framework for both the `common` and `backend` packages. However, the BDD full-stack testing suite (in `test/bdd`) and the frontend were already configured to use Vitest, creating a split testing infrastructure.

### Common Package Issues

The `common` package had duplicate test infrastructure:

1. **Duplicate test execution** - Tests were run by both Jest (via `npm test` in common) and Vitest (via the BDD suite)
1. **Jest-specific workspace issues** - Jest has strict preset resolution requirements that don't work well with npm workspaces' dependency hoisting
1. **Inconsistent developer experience** - Tests might pass with one framework but fail with the other

The BDD test suite's `vitest.config.ts` explicitly includes `common/**/*.test.{ts,tsx}`, making Jest redundant.

### Backend Package Issues

The `backend` package had 120 test files using Jest, which created:

1. **Framework inconsistency** - Backend used Jest while frontend, BDD, and common used Vitest
1. **Integration challenges** - Difficult to share test utilities and patterns across packages

## Decision

We migrated both the `common` and `backend` packages from Jest to Vitest to create a unified testing infrastructure across the entire CAMS project.

### Why Vitest?

- **Already in use** - The BDD suite runs `common` tests with Vitest
- **Better workspace support** - Vitest doesn't have the preset resolution issues that plague Jest in npm workspaces
- **Modern ESM support** - Better handling of ES modules, which `common` uses (`"type": "module"`)
- **Faster** - Vite's transformer is significantly faster than Jest's ts-jest
- **Compatible API** - Tests required minimal changes

## Status

Accepted

## Consequences

### Positive

- **Single source of truth** - `common` tests now run consistently whether executed directly or via the BDD suite
- **Eliminated workspace issues** - No more `--no-workspaces` workarounds or manual dependency copying
- **Unified testing framework** - All packages (frontend, backend, common, BDD) now use Vitest
- **Reduced maintenance** - One testing framework means one set of patterns, matchers, and configurations
- **Faster tests** - Vitest's transform layer is more performant than ts-jest
- **Consistent test utilities** - Test helpers and mocks can now be shared across all packages

## Related Decisions

- **FrontendBuildTooling.md** - Established Vitest for frontend testing
- **BddFullStackTesting.md** - Designed BDD suite to run `common` tests with Vitest
