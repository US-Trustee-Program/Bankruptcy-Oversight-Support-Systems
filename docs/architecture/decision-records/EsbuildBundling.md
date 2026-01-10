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

1. **Bundle application code** - All TypeScript source files and `@common/*` path alias imports are bundled into consolidated JavaScript files using esbuild
2. **External dependencies** - Third-party npm packages (especially those with native modules like `mongodb`, `mssql`) remain external and are installed separately via npm
3. **Shared configuration** - Common esbuild options are defined in `backend/esbuild-shared.mjs` and imported by function app build configs
4. **Automatic entry point discovery** - Build configuration automatically finds all `*.function.ts` files as entry points
5. **Preserve Azure Functions structure** - Output maintains the directory structure required by Azure Functions v4 programming model

### External Dependencies List

The following dependencies are explicitly marked as external (not bundled):

```javascript
[
  '@azure/functions',      // Cannot be bundled (dynamic requires)
  'mssql',                // Native module (platform-specific binary)
  'mongodb',              // Native module (platform-specific binary)
  'applicationinsights',
  'dotenv',
  'express',
]
```

### Build Configuration

Each function app has an `esbuild.config.mjs` that:
- Imports shared configuration from `backend/esbuild-shared.mjs`
- Automatically discovers `*.function.ts` files as entry points
- Adds the main entry point (`index.ts` or `dataflows.ts`)
- Outputs to `dist/` directory with CommonJS format

### Integration with Packaging

The esbuild output integrates with the existing packaging workflow:
1. `npm run build` - Runs esbuild to bundle code into `dist/`
2. `npm run pack` - Calls `backend/pack.sh` which:
   - Installs Linux-compatible node_modules (using Podman on macOS, direct install on Linux)
   - Creates deployment zip with `dist/`, `node_modules/`, `package.json`, and `host.json`

## Status

ACCEPTED (January 2026)

## Consequences

### Positive

1. **Solves path alias resolution** - esbuild natively resolves and bundles `@common/*` path aliases, eliminating the runtime import errors that tsc alone couldn't handle
2. **Faster builds** - Single-pass bundling is significantly faster than tsc transpilation
3. **Smaller output** - Bundled code reduces the number of files from thousands to dozens
4. **Better developer experience** - Simpler, cleaner imports using path aliases instead of deep relative paths
5. **Improved CI/CD performance** - Faster builds mean faster deployments
6. **Clearer separation of concerns** - Application code is bundled, dependencies are external
7. **Reduced deployment package complexity** - Fewer files to track and debug

### Neutral

1. **Different output structure** - Bundled code means stack traces reference bundled files, though source maps are still generated
2. **Learning curve** - Team needs to understand esbuild configuration instead of tsconfig.json

### Negative

1. **External dependencies still required** - Native modules and Azure Functions SDK cannot be bundled, so node_modules packaging complexity remains
2. **Platform-specific builds still needed** - Native modules require Linux builds (Podman on macOS, direct on Linux/CI)
3. **Debugging** - Source maps are still generated but bundled code can be harder to debug than transpiled code

### Migration Considerations

1. **package.json dependencies** - Function apps now require explicit `dependencies` field (not just devDependencies) for external modules that will be packaged
2. **pack.sh updates** - Packaging script updated to use `npm ci --workspaces=false` to force local node_modules creation instead of workspace symlinks
3. **Dockerfile.build consistency** - Linux build container must use identical npm flags as pack.sh
4. **Troubleshooting** - New TROUBLESHOOTING-AZURE-FUNCTIONS.md guide documents the esbuild architecture and common deployment issues

## Related Documentation

- `backend/esbuild-shared.mjs` - Shared esbuild configuration
- `backend/function-apps/api/esbuild.config.mjs` - API function app build config
- `backend/function-apps/dataflows/esbuild.config.mjs` - Dataflows function app build config
- `backend/pack.sh` - Packaging script with OS detection
- `backend/Dockerfile.build` - Linux build container
- `backend/TROUBLESHOOTING-AZURE-FUNCTIONS.md` - Deployment troubleshooting guide
