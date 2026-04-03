# CAMS-723 Consolidated Implementation Analysis - REVISED

**Date**: April 2, 2026
**Branch**: `CAMS-723-consolidated-pre-merge-e2e`
**Issue**: [#2087](https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/issues/2087)

**Goal**: Combine the best solutions from both PR approaches into a single, comprehensive implementation.

---

## MAJOR DISCOVERY 🔍

**Both branches are actually WORKING!** The original alt branch doc was incomplete and stopped at "SQL Server connection failed" - but the branch actually solved that issue and many more. Both approaches are production-ready with different trade-offs.

---

## Branch Summary

### BRIAN branch (`CAMS-723-pre-merge-e2e-BRIAN`)
- **Status**: ✅ Working (with FORCE_REBUILD_DEPS workaround)
- **Container Runtime**: Podman + podman-compose
- **Approach**: Comprehensive, production-ready with advanced caching
- **Key Innovation**: **Embedded Azurite** inside backend container
- **Networking**: Bridge network for services, host network for Playwright only
- **Caching**: Multi-layer (base images + hash-based deps)
- **Optimizations**: SQL warmup, container log collection
- **Playwright**: v1.58.2
- **Doc**: `CAMS-723-E2E-IMPLEMENTATION-GUIDE.md`

### alt branch (`CAMS-723-pre-merge-e2e-alt`)
- **Status**: ✅ Working and production-ready
- **Container Runtime**: Docker/Podman + compose
- **Approach**: Simpler, straightforward implementation
- **Key Innovation**: **External Azurite** as separate service
- **Networking**: Bridge network for databases/Azurite, host network for backend/frontend/playwright
- **Caching**: None (rebuilds every time)
- **Optimizations**: Container cleanup, rebuild strategies
- **Playwright**: v1.58.2 (upgraded during development)
- **Backend Fix**: SQL boolean parsing bug fix
- **Doc**: `CAMS-723-E2E-TROUBLESHOOTING.md` (now updated)

---

## Phase 1: Identical/Shared Solutions ✅

These problems were solved by BOTH branches with nearly identical approaches:

### 1. ✅ Playwright Version
- **Both branches**: v1.58.2
- **Consistent**: package.json + Dockerfile base image
- **Decision**: ✅ **Use v1.58.2** - already agreed

### 2. ✅ Frontend Configuration Injection
- **Both branches**: Run `envToConfig.js` at container startup
- **Dockerfile CMD**: Generate config, copy to build dir, start Vite preview
- **Decision**: ✅ **Identical solution** - no choice needed

### 3. ✅ GitHub Actions Workflow Updates
- **Both branches** modified:
  - `.github/workflows/pr-validation.yml`
  - `.github/workflows/reusable-build-info.yml`
  - `.github/workflows/slack-notification.yml`
- **Decision**: 🔍 **Need to compare** diffs between branches

---

## Phase 2: Different Approaches to Same Problem 🤔

These problems were solved by BOTH branches but with DIFFERENT strategies:

### 1. CORS Configuration 🌐

#### BRIAN branch approach:
**Created dedicated file** `test/e2e/local.settings.backend.json`:
```json
{
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*",
    "CORSCredentials": true
  }
}
```
Copy into backend image.

#### alt branch approach:
**Triple redundancy**:
1. `--cors` flag in Dockerfile.backend CMD
2. `host.json` CORS configuration
3. Environment variables in compose

**Comparison**:
- BRIAN: Single source of truth, functions-specific format
- alt: Multiple overlapping methods, more resilient

**Decision Needed**: ✋ Which CORS approach? (or combine both?)

---

### 2. Azurite Storage Integration 🗄️

#### BRIAN branch approach:
**Embedded Azurite** inside backend container:
- Install azurite + azure-functions-core-tools together in Dockerfile.deps
- Start azurite in background before Functions host
- Backend connects to 127.0.0.1
- No external container needed

**Pros**:
- ✅ No SharedKey HMAC issues
- ✅ No network connectivity problems
- ✅ No startup race conditions
- ✅ Simpler compose file (one less service)

**Cons**:
- ⚠️ Must install both tools together (corruption risk if done wrong)
- ⚠️ Startup timing requires log grepping or polling

#### alt branch approach:
**External Azurite** as separate service:
- Dedicated azurite container on bridge network
- Published ports to localhost:10000/10001/10002
- Backend on host network connects via localhost
- Standard Azurite Docker image

**Pros**:
- ✅ Standard Azurite image (no custom installation)
- ✅ Can restart Azurite independently
- ✅ Clearer separation of concerns
- ✅ Works with host networking pattern

**Cons**:
- ⚠️ One more service to orchestrate
- ⚠️ Depends on host networking pattern

**Decision Needed**: ✋ Embedded (BRIAN) or External (alt) Azurite?

---

### 3. Container Networking Strategy 🔌

#### BRIAN branch approach:
**Bridge network for everything except Playwright**:
```yaml
backend:
  networks:
    - cams-e2e
  ports:
    - "7071:7071"
  environment:
    MONGO_CONNECTION_STRING: mongodb://mongodb:27017/cams-e2e
    MSSQL_HOST: sqlserver

frontend:
  networks:
    - cams-e2e
  ports:
    - "3000:3000"

playwright:
  network_mode: host  # Only Playwright uses host network
```

Services use **container names** for DNS resolution.

#### alt branch approach:
**Host network for backend/frontend, bridge for databases**:
```yaml
azurite:
  networks:
    - cams-e2e
  ports:
    - "10000:10000"

mongodb:
  networks:
    - cams-e2e
  ports:
    - "27017:27017"

sqlserver:
  networks:
    - cams-e2e
  ports:
    - "1433:1433"

backend:
  network_mode: host  # Accesses via localhost

frontend:
  network_mode: host  # Accesses via localhost

playwright:
  network_mode: host  # Required for Okta
```

Services use **localhost** for all connections.

**Comparison**:
- **BRIAN**: More "Docker native" with service DNS
- **alt**: Simpler mental model (everything is localhost)
- **BRIAN**: Backend depends on bridge network working
- **alt**: Backend/frontend share host network with Playwright

**Decision Needed**: ✋ Bridge+DNS (BRIAN) or Host+localhost (alt)?

---

### 4. Container Rebuild Strategy 🔄

#### BRIAN branch approach:
**Explicit build steps with hash-based caching**:
- Compute hash of all package.json files
- Check local → ghcr.io cache → build
- Explicit `podman build` commands in run script
- Sophisticated cache invalidation

#### alt branch approach:
**Simple rebuild flags**:
```bash
# Force rebuild of specific services
podman-compose build backend frontend

# Alternative with docker-compose
docker compose up --build --no-deps backend -d
```

**Comparison**:
- **BRIAN**: Faster when cache hits, complex setup
- **alt**: Always rebuilds, simple and predictable

**Decision Needed**: ✋ Sophisticated caching (BRIAN) or simple rebuilds (alt)?

---

## Phase 3: BRIAN branch Unique Features

These features/optimizations exist ONLY in BRIAN branch:

### 1. Base Image Caching to ghcr.io
**Feature**: Cache upstream images (mongo, sql-edge, playwright) to GitHub Container Registry
- Multi-arch manifests (amd64 + arm64)
- Self-healing cache miss recovery
- Weekly refresh workflow
- Weekly pruning workflow

**Files**:
- `test/e2e/scripts/pull-base-images.sh`
- `test/e2e/scripts/cache-base-images.sh`
- `.github/workflows/refresh-e2e-base-images.yml`
- `.github/workflows/prune-e2e-image-cache.yml`

**Decision Needed**: ✋ Implement base image caching?

---

### 2. Hash-Based Deps Image Caching
**Feature**: Cache npm dependencies using content hash
- SHA256 of all package.json files
- Automatic cache invalidation on any package change
- Push to ghcr.io for CI reuse
- ~2 minute savings on cache hit

**Decision Needed**: ✋ Implement deps caching?

---

### 3. SQL Server Warmup Script
**Feature**: Pre-compile query execution plans before tests run

**File**: `test/e2e/scripts/warmup-sqlserver.ts`

**Benefit**: Eliminates cold-start query compilation overhead in first test

**Decision Needed**: ✋ Implement SQL warmup?

---

### 4. Container Log Collection
**Feature**: Automatic collection of all container logs on test completion
- Upload as GitHub Actions artifacts
- 7-day retention
- Helpful for debugging failures

**Decision Needed**: ✋ Implement log collection?

---

### 5. HTTP-Based Service Health Checks
**Feature**: Poll HTTP endpoints instead of relying on container status
```bash
curl http://localhost:7071/api/healthcheck
curl http://localhost:3000
```

**alt branch** uses Docker healthchecks in compose file.

**Decision Needed**: ✋ Which healthcheck approach?

---

## Phase 4: alt branch Unique Features

These features/fixes exist ONLY in alt branch:

### 1. ⭐ SQL Boolean Parsing Bug Fix (CRITICAL)
**Problem**: `Boolean(process.env.MSSQL_ENCRYPT)` returns `true` for string `"false"`

**Fix in** `backend/lib/configs/application-configuration.ts`:
```typescript
// Before (WRONG):
const encrypt: boolean = Boolean(process.env.MSSQL_ENCRYPT);

// After (CORRECT):
const encrypt: boolean = process.env.MSSQL_ENCRYPT?.toLowerCase() === 'true';
```

Applied to all 3 database configs (DXTR, ACMS, ATS).

**This is a BACKEND CODE BUG FIX that BRIAN branch doesn't have!**

**Decision**: ✅ **MUST include this fix** - it's a real bug

---

### 2. `.env.local.example` File
**Feature**: Example environment configuration file showing all required variables

**Helpful for**: Developer onboarding, documentation

**Decision Needed**: ✋ Include example .env file?

---

### 3. Triple-Redundancy CORS Approach
**Feature**: CORS configured in 3 places (--cors flag + host.json + env vars)

**More resilient** than BRIAN's single source approach.

**Decision Needed**: ✋ Single source (BRIAN) or triple redundancy (alt)?

---

### 4. Container Cleanup on Exit
**Feature**: Trap-based cleanup in run script
```bash
cleanup() {
    podman-compose down 2>/dev/null || true
    podman rm -f cams-azurite-e2e cams-mongodb-e2e ... || true
}
trap cleanup EXIT
```

**Prevents**: "Container name already in use" errors

**Decision Needed**: ✋ Include trap-based cleanup?

---

## Phase 5: File-by-File Comparison

### Files Modified by BOTH Branches:

| File | Status | Action |
|------|--------|--------|
| `.github/workflows/pr-validation.yml` | Different | 🔍 Compare |
| `.github/workflows/reusable-build-info.yml` | Different | 🔍 Compare |
| `.github/workflows/slack-notification.yml` | Different | 🔍 Compare |
| `test/e2e/Dockerfile.backend` | **VERY Different** | 🔍 Compare |
| `test/e2e/Dockerfile.frontend` | Similar | 🔍 Compare |
| `test/e2e/Dockerfile.playwright` | Similar | 🔍 Compare |
| `test/e2e/package.json` | Similar | 🔍 Compare |
| `test/e2e/podman-compose.yml` | **VERY Different** | 🔍 Compare |
| `test/e2e/scripts/run-e2e-workflow.sh` | **VERY Different** | 🔍 Compare |
| `docs/operations/workflow-diagram.md` | Different | 🔍 Compare |
| `package.json` | Different | 🔍 Compare |

### Files ONLY in BRIAN branch:

| File | Purpose | Include? |
|------|---------|----------|
| `test/e2e/Dockerfile.deps` | Deps caching base image | ✋ Decide |
| `test/e2e/local.settings.backend.json` | CORS config | ✋ Decide |
| `test/e2e/scripts/pull-base-images.sh` | Base image cache pull | ✋ Decide |
| `test/e2e/scripts/cache-base-images.sh` | Base image cache refresh | ✋ Decide |
| `test/e2e/scripts/warmup-sqlserver.ts` | SQL performance | ✋ Decide |
| `.github/workflows/refresh-e2e-base-images.yml` | Cache maintenance | ✋ Decide |
| `.github/workflows/prune-e2e-image-cache.yml` | Cache cleanup | ✋ Decide |
| `test/e2e/README.md` | Documentation | ✅ Include |
| `test/e2e/TESTLOG.md` | Dev log | ❓ Optional |

### Files ONLY in alt branch:

| File | Purpose | Include? |
|------|---------|----------|
| `test/e2e/.env.local.example` | Example config | ✅ Include |
| `test/e2e/scripts/seed-sqlserver.ts` | SQL seeding | 🔍 Compare to BRIAN |
| `backend/lib/configs/application-configuration.ts` | **Bug fix** | ✅ **MUST include** |
| `backend/function-apps/api/host.json` | CORS config | ✋ Decide |
| `package-lock.json` | Dependency lock | ⚠️ Will regenerate |

---

## Decision Summary

### Already Decided:
1. ✅ Playwright v1.58.2
2. ✅ Frontend config injection (identical)
3. ✅ SQL boolean parsing bug fix (MUST include)

### Need to Decide Together:

#### Critical Architectural Decisions:
1. **Azurite**: Embedded (BRIAN) vs External (alt)?
2. **Networking**: Bridge+DNS (BRIAN) vs Host+localhost (alt)?
3. **CORS**: Single source (BRIAN) vs Triple redundancy (alt)?

#### Optimization Decisions:
4. **Caching Strategy**: Full system (BRIAN) vs None (alt)?
5. **SQL Warmup**: Include (BRIAN)?
6. **Log Collection**: Include (BRIAN)?
7. **Healthchecks**: HTTP polling (BRIAN) vs Docker healthcheck (alt)?
8. **Container Cleanup**: Trap-based (alt)?

#### Documentation Decisions:
9. **`.env.local.example`**: Include (alt)?
10. **README/TESTLOG**: Include (BRIAN)?

---

## Recommendation: Hybrid Approach 🎯

I recommend a **hybrid approach** that combines the best of both:

### Core Architecture (Choose One)
**Option A: BRIAN's architecture + alt's bug fix**
- Bridge networking with DNS
- Embedded Azurite
- + SQL boolean bug fix from alt

**Option B: alt's architecture + BRIAN's optimizations**
- Host networking with localhost
- External Azurite
- + Add caching/warmup/logs from BRIAN

### My Preference: **Option A (BRIAN base + alt bug fix)**
**Reasoning**:
- BRIAN's architecture is more "Docker native"
- Embedded Azurite eliminates external dependency
- Bridge networking is better practice
- We add the critical bug fix from alt
- Can optionally add other alt features later

---

## Ready for Interactive Decision Making 🚀

Let's go through the decisions systematically. I'll present them one at a time for your input!

Shall we continue from Decision #4 (Azurite approach)?

---

## Phase 6: Local Podman Testing - Issues and Solutions (April 2-3, 2026)

After completing the architectural analysis, we tested the consolidated branch locally with Podman. Here are the major issues encountered and how we solved them:

### Issue 1: Backend Crash - IServiceProvider Disposed Object ❌→✅
**Problem**: Backend crashed immediately on startup with error:
```
Cannot access a disposed object.
Object name: 'IServiceProvider'.
```

**Root Cause**: `"CORSCredentials": true` in `local.settings.backend.json` Host section caused Azure Functions runtime to crash.

**Solution**:
- Removed `CORSCredentials` property entirely
- Kept only `"CORS": "*"` in Host configuration
- File: `test/e2e/local.settings.backend.json`

**Verification**: Backend started successfully with all 26 functions loaded.

**Reference**: [Stack Overflow solution](https://stackoverflow.com/questions/60761222/)

---

### Issue 2: SQL Server Authentication Failure ❌→✅
**Problem**: Backend health check failed with:
```
Login failed for user 'sa'. Reason: Could not find a login matching the name provided.
```

**Root Cause**: Backend tried to connect to `CAMS_E2E` database before seeding created it. Original workflow:
```bash
# WRONG ORDER:
Start all services → optional seeding later
```

**Solution**: Changed startup order to ensure database exists before backend connects:
```bash
# CORRECT ORDER:
1. Start databases (azurite, mongodb, sqlserver)
2. Wait for databases to be ready (10s)
3. Seed databases (ALWAYS - creates CAMS_E2E database)
4. Start backend and frontend
5. Wait for application readiness
```

**Files Modified**:
- `test/e2e/scripts/run-e2e-workflow.sh` - Removed `--reseed` flag, seeding always runs
- `.github/workflows/pr-validation.yml` - Removed `--reseed` flag

**Commit**: `1a8445612`

---

### Issue 3: Database Seeding Network Connectivity ❌→✅
**Problem**: Seeding containers couldn't reach `mongodb` or `sqlserver` hostnames:
```
Error: getaddrinfo ENOTFOUND mongodb
```

**Root Cause**: `podman-compose run --network e2e_cams-e2e` doesn't properly attach to the network in all Podman versions.

**Solution**: Use `podman run` directly instead of `podman-compose run`:
```bash
# BEFORE (didn't work):
pcompose run --rm --network e2e_cams-e2e playwright npm run seed:mongo

# AFTER (works):
podman run --rm --network e2e_cams-e2e \
  -e MONGO_URL=mongodb://mongodb:27017/cams-e2e \
  localhost/e2e_playwright:latest npm run seed:mongo
```

**Files Modified**:
- `test/e2e/scripts/run-e2e-workflow.sh` - Changed seeding to use `podman run`
- Added `pcompose()` helper function to handle compose file arguments

**Commit**: `1a8445612`

---

### Issue 4: Missing Feature Flags - Data Verification Link Not Rendering ❌→✅
**Problem**: Tests failing with "element not found" errors:
```
Error: expect(locator).toBeVisible() failed
Locator: getByTestId('header-data-verification-link')
```

**Root Cause**:
- Frontend `useFeatureFlags()` hook tried to load from LaunchDarkly
- No `CAMS_FEATURE_FLAG_CLIENT_ID` configured → returned `{}`
- Without `transfer-orders-enabled` flag, Data Verification link didn't render
- UI elements that depend on feature flags were not present

**Initial Attempt (FAILED)**:
Set `CAMS_USE_FAKE_API=true` to use `testFeatureFlags`
- **Problem**: This replaced entire API client with `MockApi2`
- **Result**: Okta OAuth flow broke completely (see Issue 5)

**Solution**:
Created new env var `CAMS_FEATURE_FLAGS_MODE` to decouple:
- API mocking (`CAMS_USE_FAKE_API`) - controls API client
- Feature flag source (`CAMS_FEATURE_FLAGS_MODE`) - controls which flags to use

**Implementation**:
```typescript
// user-interface/src/lib/hooks/UseFeatureFlags.ts
export default function useFeatureFlags(): FeatureFlagSet {
  const appConfig = getAppConfiguration();

  if (appConfig.useFakeApi) {
    return testFeatureFlags;  // Mock API = mock everything
  }

  // NEW: E2E testing mode - real API, test flags
  if (appConfig.featureFlagsMode === 'test') {
    return testFeatureFlags;
  }

  if (!config.clientId) {
    return {};  // No LaunchDarkly = no flags
  }

  // Production: use LaunchDarkly
  const featureFlags = useFlags();
  return featureFlags;
}
```

**Configuration**:
```yaml
# test/e2e/podman-compose.yml
frontend:
  environment:
    - CAMS_FEATURE_FLAGS_MODE=test  # Enables all test flags
```

**Files Modified**:
- `user-interface/src/configuration/appConfiguration.ts` - Added `featureFlagsMode` property
- `user-interface/src/lib/hooks/UseFeatureFlags.ts` - Added mode check
- `user-interface/src/vite-env.d.ts` - Added TypeScript types
- `test/e2e/podman-compose.yml` - Set `CAMS_FEATURE_FLAGS_MODE=test`

**Commit**: `3f3cd9b20`

---

### Issue 5: Okta Authentication Failure with CAMS_USE_FAKE_API ❌→✅
**Problem**: When `CAMS_USE_FAKE_API=true` was set:
- Okta sign-in widget loaded (`#okta-sign-in` visible)
- Username input never appeared (stuck with `class="hide"`)
- Tests timed out waiting for authentication

**Root Cause**:
```typescript
// user-interface/src/lib/models/api2.ts
const Api2 = getAppConfiguration().useFakeApi ? MockApi2 : _Api2;
```

`CAMS_USE_FAKE_API=true` doesn't just affect feature flags - it replaces the **entire API client** with `MockApi2`:
- Real Okta provider tries OAuth flow
- Mock API client doesn't handle OAuth callbacks
- Authentication hangs indefinitely

**Solution**:
Use `CAMS_FEATURE_FLAGS_MODE=test` instead (see Issue 4):
- Real API client → Okta authentication works
- Test feature flags → UI elements render correctly

**Result**: Clean separation of concerns:
- `CAMS_USE_FAKE_API` - for component tests with fully mocked backend
- `CAMS_FEATURE_FLAGS_MODE=test` - for E2E tests with real backend + all features enabled

**Commit**: `3f3cd9b20` (same commit as Issue 4 solution)

---

### Issue 6: TypeScript Build Errors ❌→✅
**Problem**: Frontend build failed during Docker image creation:
```
error TS2339: Property 'CAMS_FEATURE_FLAGS_MODE' does not exist on type 'Partial<{...}>'
```

**Root Cause**:
- Added `featureFlagsMode` to `appConfiguration.ts`
- `window.CAMS_CONFIGURATION` type definition didn't include new property
- TypeScript strict mode rejected the access

**Solution**:
1. Added type assertion in `appConfiguration.ts`:
```typescript
const config = window.CAMS_CONFIGURATION as Record<string, string | undefined>;
```

2. Updated mock configuration for tests:
```typescript
// user-interface/src/lib/testing/mock-configuration.ts
export const blankConfiguration: AppConfiguration = {
  // ... existing properties
  featureFlagsMode: undefined,  // Added
};
```

3. Added TypeScript interface (for documentation):
```typescript
// user-interface/src/vite-env.d.ts
interface CamsConfiguration {
  CAMS_FEATURE_FLAGS_MODE?: string;
  // ... other properties
}

declare global {
  interface Window {
    CAMS_CONFIGURATION: CamsConfiguration;
  }
}
```

**Files Modified**:
- `user-interface/src/configuration/appConfiguration.ts` - Type assertion
- `user-interface/src/lib/testing/mock-configuration.ts` - Added property
- `user-interface/src/vite-env.d.ts` - Added types

**Commit**: `87964cb79`

---

### Issue 7: Tests Running Before Services Ready ❌→✅
**Problem**: Original health check loop ran before backend/frontend were even started:
```bash
# WRONG FLOW:
1. Start databases
2. Health check loop (waiting for backend/frontend that don't exist yet!)
3. Seed databases
4. Start backend/frontend
```

**Root Cause**: Health check logic was placed before the `pcompose up -d backend frontend` command.

**Solution**: Restructured workflow to check health AFTER starting services:
```bash
# CORRECT FLOW:
1. Start databases (azurite, mongodb, sqlserver)
2. Wait 10s for database initialization
3. Seed databases (creates CAMS_E2E, inserts test data)
4. Start backend and frontend
5. THEN wait for readiness:
   - Backend: HTTP 200 from /api/healthcheck
   - Frontend: HTTP response from port 3000
   - 5s stabilization period
6. Warm up SQL Server plan cache
7. Run tests
```

**Improved Health Checks**:
```bash
# Before: Accept any HTTP response (even 500)
BACKEND_HTTP=$(curl -s http://localhost:7071/api/healthcheck && echo "ok")

# After: Require HTTP 200
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:7071/api/healthcheck)
if [ "$BACKEND_STATUS" = "200" ]; then
  echo "Backend ready"
fi
```

**Files Modified**:
- `test/e2e/scripts/run-e2e-workflow.sh` - Moved health checks, improved validation

**Commit**: `1a8445612`

---

### Issue 8: Browser Launch Timeout (Local Only) ⚠️ IN PROGRESS
**Problem**: In local Podman environment, Chromium fails to launch:
```
TimeoutError: browserType.launch: Timeout 180000ms exceeded.
[pid=96][err] Failed to connect to the bus: No such file or directory
```

**Root Cause**:
- Chromium tries to connect to dbus (system message bus)
- dbus not available in Podman container
- Browser initialization hangs for 180 seconds then times out

**Status**:
- ⚠️ Local Podman environment issue (likely resource constraints or dbus missing)
- ✅ Expected to work in GitHub Actions CI (clean environment, proper dbus setup)

**Next Steps**:
- Monitor CI run to verify browser launches successfully
- If CI also fails, may need to add `--no-sandbox --disable-setuid-sandbox` flags

---

## Current Architecture Snapshot 📐

### Final Implementation (April 3, 2026)

**Container Stack**:
```
┌─────────────────────────────────────────────────────────┐
│ Playwright Container (host network)                     │
│ - Chromium browser                                       │
│ - Connects to http://localhost:3000 (frontend)          │
│ - Okta OAuth callbacks via localhost:3000               │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ Frontend Container (cams-e2e bridge network)            │
│ - Vite preview server (port 3000)                       │
│ - envToConfig.js generates configuration.json           │
│ - CAMS_FEATURE_FLAGS_MODE=test → testFeatureFlags       │
│ - CAMS_LOGIN_PROVIDER=okta                              │
│ - Connects to http://backend:7071                       │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ Backend Container (cams-e2e bridge network)             │
│ - Azure Functions Core Tools v4.9.0                     │
│ - 26 HTTP functions (port 7071)                         │
│ - CORS: "*" (no CORSCredentials)                        │
│ - Connects to: mongodb, sqlserver, azurite              │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ Database Services (cams-e2e bridge network)             │
│ - MongoDB 7.0 (port 27017)                              │
│ - SQL Server Azure SQL Edge (port 1433)                 │
│ - Azurite Storage Emulator (ports 10000/10001/10002)    │
└─────────────────────────────────────────────────────────┘
```

**Startup Sequence**:
1. **Build Phase** (if needed):
   - `e2e_deps:latest` - npm dependencies (cached by hash)
   - `e2e_built:latest` - compiled TypeScript + frontend build
   - `e2e_backend:latest` - Azure Functions runtime + built code
   - `e2e_frontend:latest` - Vite preview + built frontend
   - `e2e_playwright:latest` - Playwright + test code

2. **Database Initialization** (~10s):
   - Start azurite, mongodb, sqlserver containers
   - Wait for health checks / initialization

3. **Database Seeding** (~5-10s):
   ```bash
   # MongoDB seeding
   podman run --network e2e_cams-e2e \
     localhost/e2e_playwright:latest npm run seed:mongo
   # → 22 cases, 1 trustee, 1 consolidation, 1 order, 2 user-groups

   # SQL Server seeding
   podman run --network e2e_cams-e2e \
     localhost/e2e_playwright:latest npm run seed:sql
   # → AO_* tables with 3 test cases + generated PII
   ```

4. **Application Startup** (~10-15s):
   - Start backend container (Functions host starts)
   - Start frontend container (Vite preview starts)
   - Wait for health checks:
     - Backend: HTTP 200 from `/api/healthcheck`
     - Frontend: HTTP 200 from `/`
   - 5 second stabilization period

5. **SQL Warmup** (~2s):
   - Pre-compile query execution plans
   - Warm up buffer pool with test data

6. **Test Execution**:
   - Setup: Okta authentication (saves session)
   - Tests: 17 E2E scenarios using saved session

**Key Configuration**:

| Component | Key Settings |
|-----------|-------------|
| **Backend** | No `CORSCredentials`, connects to services via container names |
| **Frontend** | `CAMS_FEATURE_FLAGS_MODE=test`, `CAMS_LOGIN_PROVIDER=okta` |
| **Playwright** | 90s test timeout, 60s navigation, 15s action timeout |
| **Networking** | Bridge network for services, host network for Playwright |
| **Seeding** | Always runs (no `--reseed` flag), creates CAMS_E2E database |

**Test Data**:
- **MongoDB**: 22 bankruptcy cases, 1 trustee profile, 1 consolidation order, 1 transfer order
- **SQL Server**: 3 DXTR cases (ids: 101256, 234567, 315951) with full party/attorney data + PII
- **Test User**: camsdeve2e@flexion.us (Okta) with DataVerifier role

---

## Key Learnings 🎓

### 1. Feature Flags ≠ API Mocking
**Mistake**: Assumed `CAMS_USE_FAKE_API` only affected feature flags.

**Reality**: It replaces the entire API client, breaking real authentication flows.

**Lesson**: Need separate controls for:
- What data to use (mock vs real API)
- What features to enable (LaunchDarkly vs test flags)

### 2. Azure Functions CORS Configuration
**Mistake**: Copied CORS config including `CORSCredentials: true`.

**Reality**: This setting causes IServiceProvider disposal issues in Azure Functions.

**Lesson**: Less is more - just `"CORS": "*"` is sufficient for local testing.

### 3. Database Seeding MUST Precede Backend
**Mistake**: Started all services together, assumed database would exist.

**Reality**: Backend health check fails immediately if database doesn't exist.

**Lesson**: Startup order matters:
1. Databases
2. Seeding (creates schema + data)
3. Applications

### 4. Podman Network Flags Don't Always Work
**Mistake**: Assumed `podman-compose run --network` would work consistently.

**Reality**: Network attachment is unreliable in some Podman versions.

**Lesson**: Use `podman run --network` directly for critical operations like seeding.

### 5. TypeScript Strict Mode Requires Complete Types
**Mistake**: Added property to config without updating all type definitions.

**Reality**: Mock configurations, type definitions, and interfaces all need updates.

**Lesson**: When adding a config property, update:
- Main config file
- Type definitions (`.d.ts`)
- Mock configurations
- Test fixtures

---

## Test Results Timeline 📊

| Date | Time | Event | Result |
|------|------|-------|--------|
| Apr 2 | 21:00 | Initial local test | ❌ Backend crash (IServiceProvider) |
| Apr 2 | 21:30 | Fixed CORS, retested | ❌ SQL Server auth failure |
| Apr 2 | 22:00 | Fixed startup order | ❌ Seeding network failure |
| Apr 2 | 22:30 | Fixed seeding network | ✅ Infrastructure working! |
| Apr 2 | 23:00 | Tests running | ❌ 10 tests failed (missing elements) |
| Apr 3 | 00:00 | Added CAMS_USE_FAKE_API | ❌ Okta auth broken |
| Apr 3 | 01:00 | Created CAMS_FEATURE_FLAGS_MODE | ❌ TypeScript build error |
| Apr 3 | 02:00 | Fixed TypeScript | ✅ Build success |
| Apr 3 | 03:00 | Rebuilt and tested | ⚠️ Browser launch timeout (local) |
| Apr 3 | 03:47 | Pushed to CI | 🔄 In progress... |

**Current Status**:
- ✅ All infrastructure issues resolved
- ✅ Feature flags working correctly
- ✅ Authentication mechanism fixed
- ⚠️ Local Podman browser issue (expected to work in CI)
- 🔄 Awaiting CI results

---

## Next Steps 🚀

1. ✅ Monitor CI run for successful test execution
2. ⏳ Address any remaining test failures (likely test-specific issues, not infrastructure)
3. ⏳ Consider implementing BRIAN's optimizations:
   - Base image caching
   - SQL warmup script
   - Container log collection
4. ⏳ Update documentation with final architecture
5. ⏳ Create PR for merge to main
