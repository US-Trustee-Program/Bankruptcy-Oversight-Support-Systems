# Monorepo Architecture: npm Workspaces

## Context

The CAMS project is a full-stack TypeScript application with multiple distinct components that share common code:

1. **Backend** - Azure Functions API and dataflows for server-side logic
2. **Frontend** - React application for the user interface
3. **Common** - Shared TypeScript code, types, and utilities used by both backend and frontend
4. **Testing** - BDD tests and end-to-end tests that need access to backend and frontend code
5. **Dev Tools** - Development utilities and tooling

Initially, these components existed as separate projects with duplicated dependencies and manual coordination of shared code. This created several challenges:

1. **Dependency duplication** - Each project had its own node_modules with overlapping dependencies
2. **Version inconsistencies** - Difficult to keep dependencies synchronized across projects
3. **Shared code management** - No standard mechanism for sharing code between backend and frontend
4. **Complex build orchestration** - Manual coordination of build order to ensure common code was built before dependent projects
5. **Difficult refactoring** - Changes to shared code required updates across multiple isolated projects
6. **Inefficient CI/CD** - Each project installed dependencies separately, wasting time and storage

Several monorepo solutions were considered:
- **Lerna** - Popular but adds complexity and has been less actively maintained
- **Yarn Workspaces** - Requires switching package managers from npm
- **pnpm Workspaces** - Requires switching package managers and has a steeper learning curve
- **npm Workspaces** - Native npm solution, no additional tools required

## Decision

We adopted npm workspaces as the monorepo solution for CAMS. The repository is structured as a two-level workspace hierarchy:

### Root Level Workspaces

The root `package.json` defines top-level workspaces:

```json
{
  "workspaces": [
    "common",
    "backend",
    "user-interface",
    "dev-tools",
    "test/bdd",
    "test/e2e"
  ]
}
```

### Nested Backend Workspaces

The `backend/` workspace contains its own nested workspaces for Azure Functions apps:

```json
{
  "workspaces": [
    "function-apps/api",
    "function-apps/dataflows"
  ]
}
```

This creates the following structure:

```
cams/                           # Root workspace
├── package.json                # Root package.json with workspaces
├── node_modules/               # Shared dependencies hoisted here
├── common/                     # Shared code workspace
├── backend/                    # Backend parent workspace
│   ├── package.json            # Backend workspace with nested workspaces
│   ├── node_modules/           # Backend-specific shared dependencies
│   └── function-apps/
│       ├── api/                # API function app workspace
│       │   └── package.json
│       └── dataflows/          # Dataflows function app workspace
│           └── package.json
├── user-interface/             # Frontend workspace
├── dev-tools/                  # Dev tools workspace
├── test/
│   ├── bdd/                    # BDD test workspace
│   └── e2e/                    # E2E test workspace
```

### Dependency Management Strategy

1. **Common dependencies at root** - Shared development dependencies (TypeScript, ESLint, Prettier, Vitest) are installed at the root level
2. **Workspace-specific dependencies** - Each workspace declares its own runtime dependencies in its package.json
3. **Hoisting** - npm automatically hoists compatible dependencies to the root node_modules
4. **Nested workspace isolation** - Backend function apps can have isolated dependencies when needed using `--workspaces=false` flag

### Path Alias Resolution

TypeScript path aliases enable workspaces to reference common code:

```typescript
// In backend or frontend code
import { CaseDetail } from '@common/cams/cases';
```

These are configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@common/*": ["../common/src/*"]
    }
  }
}
```

Build tools handle path alias resolution:
- **esbuild** (backend) - Resolves and bundles `@common/*` imports directly
- **Vite** (frontend) - Resolves `@common/*` imports via vite-tsconfig-paths plugin

### Workspace Scripts

The root package.json provides convenience scripts that delegate to workspace scripts:

```json
{
  "scripts": {
    "build": "npm run build:backend && npm run build:user-interface",
    "build:backend": "npm run build:common && npm run build --workspace=backend",
    "build:common": "npm run build --workspace=common",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present -- --quiet"
  }
}
```

## Status

ACCEPTED (Adopted throughout 2024-2025, documented January 2026)

## Consequences

### Positive

1. **Single dependency installation** - `npm ci` at root installs all dependencies for all workspaces
2. **Version consistency** - Shared dependencies are automatically kept in sync via hoisting
3. **Simplified builds** - Build order is handled automatically through workspace dependency resolution
4. **Better code sharing** - Path aliases provide type-safe imports of common code
5. **Reduced storage** - Hoisted dependencies eliminate duplication
6. **Faster CI/CD** - Single npm install is faster than multiple separate installs
7. **Native tooling** - No additional package manager or tooling required
8. **Atomic refactoring** - Changes to common code can be tested across all workspaces in a single commit
9. **Consistent tooling** - ESLint, Prettier, and TypeScript configurations can be shared

### Neutral

1. **Two-level workspace hierarchy** - Backend uses nested workspaces, which adds some complexity but enables better isolation for Azure Functions deployment
2. **Learning curve** - Team needs to understand workspace concepts and `--workspace` flags

### Negative

1. **Symlink-based linking** - npm workspaces use symlinks, which can interfere with Azure Functions packaging (mitigated with `--workspaces=false` flag during deployment)
2. **Dependency resolution complexity** - Hoisting can sometimes lead to unexpected dependency resolution (rare in practice)
3. **Tooling assumptions** - Some tools may not understand workspace structure (though most modern tools do)

### Special Considerations for Azure Functions Deployment

Azure Functions deployment requires physical copies of dependencies, not symlinks. The `backend/pack.sh` script handles this:

```bash
# Force local node_modules creation instead of workspace symlinks
npm ci --production --ignore-scripts=false --workspaces=false
```

This ensures the deployment package contains real dependency files, not symlinks to the parent workspace.

### Integration with Other Tools

- **Knip** (dead code detection) - Fully supports npm workspaces with workspace-specific configuration
- **ESLint** - Runs across all workspaces via `npm run lint --workspaces`
- **Vitest** - Each workspace has its own test configuration
- **esbuild** - Bundles `@common/*` imports in backend workspaces
- **Vite** - Resolves `@common/*` imports in frontend workspace

## Related ADRs

- **EsbuildBundling.md** - Documents how esbuild resolves path aliases in backend workspaces
- **DeadCodeDetection.md** - Documents Knip configuration for monorepo workspaces

## Related Documentation

- Root `package.json` - Top-level workspace configuration
- `backend/package.json` - Nested workspace configuration
- `backend/pack.sh` - Deployment packaging with `--workspaces=false`
- `tsconfig.json` files - Path alias configuration in each workspace
