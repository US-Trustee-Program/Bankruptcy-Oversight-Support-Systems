# CI/CD Docker Container

## Context

The CAMS project has experienced inconsistent CI/CD pipeline runs in the self-hosted Azure DevOps (ADO) environment. Pipelines that previously succeeded would intermittently fail, or builds would behave differently across runs without code changes. These inconsistencies slowed development velocity.

## Decision

We will create a Docker container specifically for running tests and producing deployment artifacts in CI/CD pipelines. This container:

- Uses `node:22.17.1-bookworm-slim` as the base image (matching `.nvmrc` version)
- Includes necessary system dependencies: `zip`, `git`, `ca-certificates`
- Sets minimal CI environment variables (`CI=true`, `NPM_CONFIG_LOGLEVEL=warn`)
- Does NOT pre-configure test-specific environment variables (these are set by npm test scripts to avoid accidental use in builds)
- Optimizes build caching by copying package files before source code
- Supports both test execution and artifact production workflows

**Base Image Rationale**: We chose `bookworm-slim` over Alpine because:
- The backend uses native Node modules (`mssql`, `mongodb` drivers) that require glibc
- Alpine uses musl libc, which would compile native bindings incompatible with Azure Functions (which runs on glibc-based Ubuntu)
- bookworm-slim is only ~40MB larger but provides full compatibility with production deployment targets

**Version Management**: The Dockerfile's Node.js version is pinned and Renovate updates are disabled (matching the existing nvm update policy) to maintain consistency with current deployment infrastructure.

**Repository Location**: The Dockerfile is stored at `.github/docker/Dockerfile.build-and-test` in the CAMS repository (not ADO-Mirror) because:
- Single source of truth for Node version (alongside `.nvmrc`)
- Dependency versions stay in sync with `package.json` files
- Renovate can manage Docker dependencies alongside npm dependencies
- Build context can reference repository files efficiently

## Status

Accepted

## Consequences

### Positive

- **Decouples from ADO runner versions**: Can update Node.js independently of Microsoft's ADO runner update schedule
- **Consistent environments**: Identical build environment across local development, CI/CD, and debugging
- **Faster builds**: Docker layer caching means subsequent runs only rebuild changed layers
- **Reproducible**: Can reproduce exact CI/CD environment locally: `docker run --rm cams-build npm test`
- **Explicit dependencies**: All system dependencies documented in Dockerfile rather than assumed
- **Future flexibility**: Can enable Renovate's Node.js updates when ready to decouple from ADO constraints

### Negative

- **Build time overhead**: Initial image build takes longer than using pre-configured ADO runners (mitigated by layer caching)
- **Maintenance**: Need to maintain Dockerfile alongside other infrastructure
- **Image storage**: Requires container registry for sharing images across pipeline runs
- **Learning curve**: Team must understand Docker basics for local debugging

## Related Files

- `.github/docker/Dockerfile.build-and-test` - Container definition
- `.github/docker/test-dockerfile.sh` - Comprehensive test suite for verifying container functionality
- `.dockerignore` - Optimizes build context
- `renovate.json` - Disables Docker Node.js version updates (line 51-56)
- `.nvmrc` - Source of truth for Node.js version
