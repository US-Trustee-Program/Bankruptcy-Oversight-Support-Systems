# Monorepo Architecture: npm Workspaces

## Context

The CAMS project is a full-stack TypeScript application with multiple distinct components that share common code:

1. **Backend** - Azure Functions API and dataflows for server-side logic
2. **Frontend** - React application for the user interface
3. **Common** - Shared TypeScript code, types, and utilities used by both backend and frontend
4. **Testing** - BDD tests and end-to-end tests that need access to backend and frontend code
5. **Dev Tools** - Development utilities and tooling

## Decision

We adopted npm workspaces as the monorepo solution for CAMS. Since the project already uses npm as the package manager, npm workspaces was the natural choice, requiring no tooling changes or migration to a different package manager.

### Architecture

The repository uses a two-level workspace hierarchy:

1. **Root workspaces** - Top-level components (common, backend, user-interface, dev-tools, test workspaces)
2. **Nested backend workspaces** - Azure Functions apps (api, dataflows) are nested within the backend workspace

See root `package.json` and `backend/package.json` for current workspace configuration.

### Key Characteristics

- **Dependency hoisting** - npm automatically hoists compatible dependencies to minimize duplication
- **Single lockfile** - Root `package-lock.json` is the single source of truth for all dependency versions
- **TypeScript path aliases** - Workspaces reference shared code via `@common/*` path aliases
- **Build tool integration** - esbuild (backend) and Vite (frontend) resolve path aliases during builds

## Status

ACCEPTED

## Consequences

### Positive

1. **Single dependency installation** - One `npm ci` at root installs all workspace dependencies
2. **Version consistency** - Dependency hoisting keeps versions synchronized
3. **Better code sharing** - TypeScript path aliases enable type-safe imports of shared code
4. **Atomic changes** - Changes to common code can be tested across all workspaces in a single commit
5. **No additional tooling** - Uses existing npm, no new package manager required

### Negative

1. **Symlink-based linking** - npm workspaces use symlinks, which interfere with Azure Functions packaging
2. **Learning curve** - Team needs to understand workspace concepts and npm workspace flags

### Special Considerations for Azure Functions Deployment

Azure Functions deployment requires physical copies of dependencies, not symlinks. The packaging process uses `npm ci --workspaces=false` to create local node_modules without workspace linking.

**Lockfile Strategy**: The monorepo uses a single root `package-lock.json` as the source of truth. Individual function apps do NOT have their own lockfiles. This ensures consistent dependency resolution across all environments. See `backend/pack.sh` and `backend/Dockerfile.build` for implementation details.

## Related ADRs

- **EsbuildBundling.md** - How esbuild resolves path aliases in backend workspaces
- **DeadCodeDetection.md** - Knip configuration for monorepo workspaces

## Related Documentation

- Root and backend `package.json` files - Workspace configurations
- `backend/pack.sh` and `backend/Dockerfile.build` - Azure Functions packaging with lockfile strategy
- `tsconfig.json` files - TypeScript path alias configuration
