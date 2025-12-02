# Dead Code Detection Tooling

## Context

As the CAMS codebase has grown, concerns emerged about accumulating unused code, dependencies, and exports across the monorepo. Dead code presents several challenges:

- **Maintenance burden** - Unused code must still be maintained, refactored, and kept secure
- **Build performance** - Unused dependencies increase bundle sizes and build times
- **Developer confusion** - Developers waste time understanding code that isn't actually used
- **Security risk** - Unused dependencies may contain vulnerabilities that require patching
- **Code quality** - Accumulation of dead code signals poor repository hygiene

The monorepo structure adds complexity, with three main TypeScript projects (`backend/`, `user-interface/`, `common/`) each with their own `tsconfig.json` and package dependencies. We needed a tool that could:

1. Identify unused files, dependencies, and exports across the entire monorepo
2. Handle TypeScript and React projects
3. Support monorepo architectures with multiple workspaces
4. Require minimal configuration while being accurate
5. Be actively maintained to keep pace with ecosystem changes

Several tools were evaluated:

**ts-prune** (v0.10.3, last updated May 2022)
- Zero-configuration detection of unused exports
- Narrow focus on exports only, doesn't detect unused dependencies or files
- In maintenance mode; author recommends migrating to Knip
- 2.1k GitHub stars

**ts-unused-exports** (v11.0.1, last updated Nov 2024)
- Identifies unused exported symbols
- Focuses only on exports, not dependencies or files
- Active but less comprehensive than alternatives
- 794 GitHub stars

**dead-code-checker** - Not evaluated due to lack of active maintenance signals

**Knip** (v5.71.0, last updated Dec 2025)
- Comprehensive detection: unused files, dependencies, exports, types, and enum members
- Excellent monorepo support with workspace-specific configuration
- 100+ built-in plugins for popular frameworks and tools
- "Crazy good automatic detection" with minimal configuration needs
- Very active development (9.6k GitHub stars)
- Recommended by ts-prune maintainers as migration path
- Battle-tested (Vercel removed 300k lines of unused code using it)

## Decision

We will use **Knip** as our dead code detection tool for the following reasons:

1. **Most comprehensive** - Detects unused files, dependencies, devDependencies, exports, types, and enum members
2. **Actively maintained** - Updated regularly with latest release from December 2025
3. **Monorepo-first design** - Built specifically to handle monorepos with multiple workspaces
4. **Minimal configuration** - Automatic detection reduces setup burden while remaining configurable
5. **Ecosystem integration** - 100+ plugins provide out-of-box support for Jest, ESLint, Vite, React, and more
6. **Industry adoption** - Used by major companies like Vercel, demonstrating production readiness
7. **Migration path** - Recommended by maintainers of competing tools

Knip will be configured at the repository root with workspace-specific entry points for each subproject:

- Root workspace: ESLint configuration
- Backend workspace: Azure Functions, dataflows setup, Express server
- User-interface workspace: React entry point, Vite/Vitest configs, test files
- Common workspace: Package exports
- Test/e2e workspace: End-to-end test files

False positives from runtime dependencies (Azure SDKs), CSS frameworks (USWDS), and tooling dependencies (ESLint plugins loaded via `require()`) will be explicitly ignored in configuration.

## Status

Accepted

## Consequences

**Positive:**
- Developers can identify and remove dead code across the entire monorepo
- Reduced bundle sizes and improved build performance from removing unused dependencies
- Better code discoverability - fewer false leads when searching for functionality
- Automated detection prevents accumulation of new dead code
- Can be integrated into CI/CD pipeline for continuous monitoring

**Negative:**
- Requires initial configuration effort to reduce false positives for the monorepo structure
- Some legitimate exports (e.g., test utilities, future APIs) may be flagged and need explicit ignoring
- Tool output must be reviewed carefully; not all "unused" code should be immediately removed
- Configuration must be maintained as project structure evolves

**Neutral:**
- Knip exits with non-zero status when issues are found, which can be used in CI but requires careful setup
- Reports can be verbose for large codebases; markdown reporter recommended for readability
- Tool identifies both trivial issues (duplicate exports) and significant issues (unused dependencies)

We will run Knip periodically during development and code review to maintain repository hygiene. The configuration is stored in `knip.json` at the repository root. A `npm run knip` script has been added to `package.json` for convenience.
