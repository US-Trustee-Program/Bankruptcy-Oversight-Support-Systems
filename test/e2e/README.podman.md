# E2E Testing with Podman - Architecture & Optimization

Optimized containerized E2E testing with intelligent layer caching for fast iteration.

## Architecture Overview

### Optimized Build Strategy

The Docker build uses a **cached dependencies approach** to minimize rebuild time:

```
Dockerfile.deps (cached base - rebuilt only when dependencies change)
├── System packages (curl, libicu72)
├── Azure Functions Core Tools
├── package*.json files
└── npm ci (all workspace dependencies)
    ↓
    ├─> Dockerfile.backend (fast rebuild - only source changes)
    │   ├── Source code (common, backend)
    │   └── Builds (build:common, build:backend)
    │
    ├─> Dockerfile.frontend (fast rebuild - only source changes)
    │   ├── Source code (common, user-interface)
    │   └── Builds (build:common, build:frontend)
    │
    └─> Dockerfile.playwright (fast rebuild - only source changes)
        ├── node_modules from deps (cached)
        ├── Source code (all workspaces)
        └── Build (build:common)
```

### Key Optimization Benefits

✅ **Deps image built once**: System packages and `npm ci` only run when dependencies change
✅ **Fast subsequent builds**: Only rebuilds source code layers (~30-60s vs 5+ minutes)
✅ **No duplicate installs**: Debian packages installed once in deps, reused by all services
✅ **Optimal layer caching**: Separate layers for dependencies (rarely change) vs source code (frequently changes)
✅ **Single source of truth**: All services use same node_modules from cached deps image

## Performance

| Scenario | Deps Build | Service Builds | Total Time |
|----------|-----------|----------------|------------|
| **First run** (no cache) | 5-7 min | 2-3 min | **8-10 min** |
| **Subsequent runs** (deps cached) | skipped | 30-60 sec | **1-2 min** |
| **After package.json change** | 5-7 min | 30-60 sec | **6-8 min** |

## Quick Start

### First Time Setup

```bash
cd test/e2e

# Build deps image (one time - will be cached)
npm run podman:rebuild-deps

# Run complete E2E workflow
npm run e2e
```

### Daily Development Workflow

```bash
# Just run tests - deps are cached, only source code rebuilds
npm run e2e
```

## When to Rebuild Deps Image

Rebuild `e2e_deps` only when:
- ✅ Adding/removing npm packages in any workspace
- ✅ Updating package versions in package.json files
- ✅ After running `npm run podman:clean` (removes all images)
- ❌ **NOT** after source code changes (automatic, fast)

```bash
npm run podman:rebuild-deps
```

## Available Commands

### Main Workflow
```bash
npm run e2e                    # Complete workflow: build → test → report → teardown
```

### Dependency Management
```bash
npm run podman:rebuild-deps    # Rebuild deps image (after package.json changes only)
```

### Service Management
```bash
npm run podman:services        # Start backend + frontend (no tests)
npm run podman:debug           # Start services with live logs
npm run podman:logs            # View service logs
npm run podman:status          # Check service status
npm run podman:down            # Stop all services
```

### Cleanup
```bash
npm run podman:clean           # Remove all images, volumes, test results
npm run podman:rebuild         # Force rebuild all service images (no cache)
```

### Testing
```bash
npm run podman:test            # Run tests in container
npm run report                 # Open Playwright HTML report
```

## How the Workflow Works

### Step 1: Build Deps Image (Cached)
```bash
# Check if localhost/e2e_deps:latest exists
podman images localhost/e2e_deps:latest
```

- **If found**: Skip build, use cached image ✅
- **If not found**: Build from `Dockerfile.deps` (slow, first time only)

The workflow script automatically checks and only rebuilds if needed.

### Step 2: Build Service Images (Fast)
```bash
podman-compose build backend frontend playwright
```

All services build from the cached deps image:
- Backend: Copies source, runs `build:common` + `build:backend`
- Frontend: Copies source, runs `build:common` + `build:frontend`
- Playwright: Copies node_modules + source, runs `build:common`

**Result**: ~30-60 seconds total (vs 5+ minutes without caching)

### Step 3: Start Services
```bash
podman-compose up -d backend frontend
```

- Backend starts on `localhost:7071`
- Frontend starts on `localhost:3000`
- Script waits for both to respond before proceeding

### Step 4: Run Tests
```bash
podman-compose up playwright
```

- Playwright container uses **host network mode**
- Connects to `localhost:3000` (required for Okta callbacks)
- Runs all E2E tests
- Exits with status code (0 = success)

### Step 5: Cleanup
```bash
podman-compose down
```

- Stops all containers
- Preserves test results in `./test-results/`
- Preserves HTML report in `./playwright-report/`

## Network Architecture

### Service Communication

- **Backend**: Bridge network `cams-e2e`, accessible as `backend:7071` internally
- **Frontend**: Bridge network `cams-e2e`, accessible as `frontend:3000` internally, exposed on host as `localhost:3000`
- **Playwright**: **Host network mode** - accesses `localhost:3000` directly

### Why Host Network for Playwright?

Okta authentication requires callback URLs in a whitelist. The whitelist only includes:
- ✅ `http://localhost:3000`
- ❌ `http://frontend:3000` (not whitelisted)

By using host network mode, Playwright accesses the frontend via `localhost:3000`, making Okta callbacks work correctly.

## Configuration

Environment variables in `test/e2e/.env`:

```bash
# Target (must be localhost for Okta callbacks)
TARGET_HOST=http://localhost:3000

# Authentication
CAMS_LOGIN_PROVIDER=okta
OKTA_USER_NAME=camsdeve2e@flexion.us
OKTA_PASSWORD=<password>

# Databases
COSMOS_DATABASE_NAME=cams-e2e
MONGO_CONNECTION_STRING=<connection-string>
DATABASE_MOCK=false

# SQL Server
MSSQL_HOST=<host>
MSSQL_DATABASE_DXTR=<database>
MSSQL_USER=<user>
MSSQL_PASS=<password>
MSSQL_ENCRYPT=true
MSSQL_TRUST_UNSIGNED_CERT=true

SLOT_NAME=local
```

## Troubleshooting

### Slow builds after code changes

**Expected**: 30-60 seconds for service builds (source code only)
**If slower**: Check if deps image exists

```bash
podman images localhost/e2e_deps:latest
```

If not found, rebuild:
```bash
npm run podman:rebuild-deps
```

### Slow builds after package.json changes

**Expected**: Need to rebuild deps image (~5-7 minutes one time)

```bash
npm run podman:rebuild-deps
npm run e2e
```

### "No such image: localhost/e2e_deps"

Build the deps image first:
```bash
npm run podman:rebuild-deps
```

### Services won't start

Check logs for errors:
```bash
npm run podman:logs
```

Clean and rebuild everything:
```bash
npm run podman:clean
npm run podman:rebuild-deps
npm run e2e
```

### Tests failing with authentication errors

1. Verify `.env` has correct Okta credentials
2. Confirm Playwright uses host network mode (check `podman-compose.yml`)
3. Verify frontend is accessible at `http://localhost:3000`
4. Check that `TARGET_HOST=http://localhost:3000` in `.env`

### Database connection errors

These are expected if:
- Database credentials in `.env` are invalid
- Firewall blocks container access to Azure databases

**Solution**: Use `DATABASE_MOCK=true` in `.env` for local testing

## CI/CD Integration

This Podman setup can be used in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    cd test/e2e
    npm run podman:rebuild-deps  # Cache this step in CI
    npm run e2e
```

## Docker Image Layers Explained

### Dockerfile.deps (Cached Base)
```dockerfile
FROM node:20-bookworm-slim                    # Layer 1: Base OS
RUN apt-get update && apt-get install -y ...  # Layer 2: System packages
RUN npm install -g azure-functions-core-tools # Layer 3: Azure Functions
COPY package*.json ...                        # Layer 4: Package files
RUN npm ci                                    # Layer 5: Dependencies (cached!)
```

**Layers 1-5 cached**: Only rebuild when package.json changes

### Dockerfile.backend (Fast Rebuild)
```dockerfile
FROM localhost/e2e_deps:latest                # Uses cached deps
COPY common/ backend/ ...                     # Layer 6: Source (rebuilds frequently)
RUN npm run build:common && npm run build ... # Layer 7: Build (rebuilds frequently)
```

**Layers 1-5 reused**: Only layers 6-7 rebuild on source changes

### Result
- **Without caching**: Rebuild all 7 layers (~5-7 minutes)
- **With caching**: Reuse layers 1-5, rebuild only 6-7 (~30-60 seconds)

## Benefits

✅ **Fast iteration**: Source changes rebuild in under a minute
✅ **Consistent environment**: Same setup for all developers and CI/CD
✅ **Minimal waste**: Only rebuilds what actually changed
✅ **No local dependencies**: No need to install Azure Functions, manage terminals, etc.
✅ **Isolated testing**: Tests run in clean containers
✅ **Easy debugging**: Keep services running while iterating on tests
✅ **CI/CD ready**: Cache deps layer in CI for fast pipeline runs
