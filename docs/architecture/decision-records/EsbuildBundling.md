# Backend Build Tooling: esbuild

## Context

The CAMS backend uses Azure Functions v4 with Node.js and TypeScript. The backend codebase is organized as a nested npm workspace structure:
- Root workspace (`backend/`) contains shared libraries and utilities
- Nested workspaces (`backend/function-apps/api`, `backend/function-apps/dataflows`) are Azure Functions apps that depend on the root workspace

### Previous Approach: tsc with Deep Relative Imports

Previously, the build process used the TypeScript compiler (tsc) alone. The function apps imported shared code from the `common` workspace using deep relative paths:

```typescript
// Example of old import style
import { CaseDetail } from '../../../common/src/cams/cases';
```

The tsc compiler would transpile TypeScript to JavaScript, preserving these relative imports. The `pack.sh` script would package the transpiled code along with the common code, and everything worked because the relative paths remained valid in the deployment package.

### The Problem: Path Aliases Break tsc-Only Builds

When the codebase was refactored to use path aliases in tsconfig and package.json:

```typescript
// New import style with path aliases
import { CaseDetail } from '@common/cams/cases';
```

This created a problem: tsc transpiles TypeScript to JavaScript but **does not resolve path aliases**. The transpiled output still contained `@common/*` imports, which are not valid Node.js module specifiers. The deployment package would fail at runtime because Node.js couldn't resolve these paths.

This approach had several limitations:

1. **Path alias resolution** - tsc does not resolve path aliases, leaving invalid imports in the transpiled output
2. **No bundling** - All TypeScript files were transpiled individually, creating hundreds of separate JavaScript files
3. **Large deployment packages** - Without bundling, the deployment package included hundreds of individual files plus full source maps
4. **Slower builds** - Transpiling each file separately was slower than bundled compilation

## Decision

We migrated from tsc to esbuild for building the backend Azure Functions applications. The new build strategy:

1. **Bundle application code** - All TypeScript source files and `@common/*` path alias imports are bundled into a single consolidated JavaScript file using esbuild
2. **Single entry point** - Uses `index.ts` that imports all function modules, eliminating code duplication across functions
3. **External dependencies** - Third-party npm packages (especially those with native modules like `mongodb`, `mssql`) remain external and are installed separately via npm
4. **Shared configuration** - Common esbuild options are defined in `backend/esbuild-shared.mjs` and imported by function app build configs

### Build Configuration

The API function app uses a single entry point strategy:
- `backend/function-apps/api/index.ts` imports all function modules
- Each function module registers itself via `app.http()` when imported
- `esbuild.config.mjs` bundles everything into a single `dist/index.js`
- Shared code (backend lib, Azure utilities, @common/* imports) is included exactly once
- Prevents very large deployment artifacts by eliminating code duplication

### Integration with Packaging

The esbuild output integrates with the existing packaging workflow:
1. `npm run build` - Runs esbuild to bundle code into `dist/`
2. `npm run pack` - Calls `backend/pack.sh` which:
   - Installs Linux-compatible node_modules (using Podman on macOS, direct install on Linux)
   - Creates deployment zip with `dist/`, `node_modules/`, `package.json`, and `host.json`

## Status

ACCEPTED

## Consequences

### Positive

1. **Solves path alias resolution** - esbuild natively resolves and bundles `@common/*` path aliases, eliminating the runtime import errors that tsc alone couldn't handle
2. **Eliminates code duplication** - Single entry point bundles shared code once, preventing very large deployment artifacts
3. **Cleaner imports** - Enables simpler imports using path aliases instead of deep relative paths
4. **Faster builds** - Single bundle build is significantly faster than multiple entry points

### Negative

1. **Platform-specific builds still required** - Native modules require Linux builds (Podman on macOS, direct on Linux/CI)
2. **Bundled code complexity** - Source maps help, but debugging bundled code is harder than individual transpiled files

## Related Documentation

- `backend/esbuild-shared.mjs` - Shared esbuild configuration
- `backend/function-apps/api/index.ts` - Single entry point that imports all functions
- `backend/function-apps/api/esbuild.config.mjs` - API function app build config
- `backend/function-apps/dataflows/esbuild.config.mjs` - Dataflows function app build config
- `backend/pack.sh` - Packaging script with OS detection
- `backend/Dockerfile.build` - Linux build container
