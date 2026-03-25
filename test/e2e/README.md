# CAMS End-to-End Testing

Automated browser-based testing using Playwright against the complete CAMS application stack, run in a self-contained Podman environment.

## Quick Start

```bash
cd test/e2e

# First time: install Podman and build the dependency image
npm run podman:install
npm run podman:rebuild-deps

# Run tests (uses existing database data)
npm run e2e

# First run, or after data issues: reseed databases before running
npm run e2e:reseed
```

## Prerequisites

Run the automated installer, which checks and installs all required dependencies:

```bash
npm run podman:install
```

This installs Podman, podman-compose, and initializes the Podman machine. Requires Homebrew.

To install manually:

```bash
brew install podman podman-compose
podman machine init
podman machine start
```

### Environment Configuration

A `.env` file in `test/e2e/` is required. It contains database connection strings and Okta credentials and is not committed to the repository.

## Available Commands

### Running Tests

```bash
npm run e2e               # Run workflow using existing database data (faster)
npm run e2e:reseed        # Clear and reseed both databases, then run tests
npm run e2e:open          # Run tests and open HTML report in browser
npm run e2e:full          # Reseed + run tests + open report
```

### Seeding Databases

```bash
npm run seed              # Seed MongoDB from fixtures/mongo-fixture.json
npm run seed:sql          # Seed SQL Server from fixtures/sqlserver-fixture.json
npm run seed:all          # Seed both databases
```

### Updating Fixture Files

Fixtures are committed to the repo and only need updating when the underlying test data changes in the source databases. Requires DXTR credentials in `.env`.

```bash
npm run harvest           # Dump e2e MongoDB + pull SQL rows from DXTR → rebuild fixtures
npm run harvest:reseed    # Re-seed MongoDB from DXTR first, then harvest (full refresh)
```

### Podman Infrastructure

```bash
npm run podman:install        # Install Podman dependencies (first time only)
npm run podman:rebuild-deps   # Rebuild deps image (after package.json changes only)
npm run podman:services       # Start backend + frontend without running tests
npm run podman:debug          # Start services in foreground with live logs
npm run podman:logs           # View logs from all running services
npm run podman:status         # Check container status
npm run podman:down           # Stop all services
npm run podman:rebuild        # Force rebuild all service images (no cache)
npm run podman:clean          # Remove all images, volumes, and test results
npm run report                # Open last Playwright HTML report
```

### Local (without Podman)

```bash
npm run test        # Interactive Playwright UI mode
npm run headless    # Headless mode (CI)
```

## Project Structure

```
test/e2e/
├── playwright/                    # Test specs
│   ├── auth-setup.ts              # Okta login — writes playwright/.auth/user.json
│   ├── case-notes.spec.ts
│   ├── consolidation-orders.spec.ts
│   ├── transfer-orders.spec.ts
│   └── fixture/urlQueryString.ts  # Custom test fixture
├── fixtures/
│   ├── mongo-fixture.json         # Committed test data for MongoDB (no PII)
│   └── sqlserver-fixture.json     # Committed test data for SQL Server (no PII)
├── scripts/
│   ├── run-e2e-workflow.sh        # Full orchestration: build → seed → test → report → teardown
│   ├── run-e2e-podman.sh          # Lightweight runner for tests only
│   ├── seed-database.ts           # Seeds MongoDB from mongo-fixture.json
│   ├── seed-sqlserver.ts          # Seeds SQL Edge from sqlserver-fixture.json
│   ├── warmup-sqlserver.ts        # Pre-warms SQL Server plan cache before tests
│   ├── harvest-fixtures.sh        # Entry point: runs harvest-mongo + harvest-sqlserver + synthesize
│   ├── harvest-mongo.ts           # Dumps live e2e MongoDB → fixtures/mongo-harvested.json
│   ├── harvest-sqlserver.ts       # Pulls DXTR SQL rows → fixtures/sqlserver-harvested.json
│   ├── synthesize-fixtures.ts     # Builds committed fixtures from harvested files
│   ├── extract-case-ids.ts        # Utility for fixture inspection
│   └── install-podman.sh          # Podman dependency installer
├── Dockerfile.deps                # Cached base image (system deps + npm ci)
├── Dockerfile.backend             # Backend service image
├── Dockerfile.frontend            # Frontend service image
├── Dockerfile.playwright          # Playwright test runner image
├── podman-compose.yml             # Container orchestration
├── playwright.config.ts           # Playwright configuration
├── package.json
└── .env                           # Environment configuration (not committed)

# Gitignored outputs
test-results/                      # Screenshots, traces, videos
playwright-report/                 # HTML test report
backend-logs/                      # Backend log captured after each run
fixtures/*-harvested.json          # Intermediate harvest files
mongodb-data/                      # Persisted MongoDB volume
sqlserver-data/                    # Persisted SQL Server volume
```

## Test Data

### How Fixtures Work

Test data lives in two committed JSON files:

- `fixtures/mongo-fixture.json` — seeded into the MongoDB `cams-e2e` database
- `fixtures/sqlserver-fixture.json` — seeded into the SQL Edge `CAMS_E2E` database

These files contain no PII. When the seed scripts run, they generate synthetic Faker values for any nulled PII columns at seed time. No live database credentials are required to run tests.

### When to Reseed

```bash
npm run e2e:reseed
```

- First time running tests (no schema or data exists yet)
- After pulling updated fixture files from the repo
- After data corruption or a partially completed test run left stale records

### Updating Fixtures

Fixtures should be updated when the E2E test data in the source databases changes (new cases, schema changes, etc.). This is a one-time operation that requires DXTR credentials.

The fixture pipeline:

```
harvest-mongo.ts     → fixtures/mongo-harvested.json      (gitignored)
harvest-sqlserver.ts → fixtures/sqlserver-harvested.json  (gitignored)
                              ↓
                  synthesize-fixtures.ts
                              ↓
fixtures/mongo-fixture.json       (committed, no PII)
fixtures/sqlserver-fixture.json   (committed, no PII)
```

Run the full harvest:

```bash
npm run harvest           # Harvest from live sources and rebuild fixtures
npm run harvest:reseed    # Re-seed MongoDB from DXTR first, then harvest
```

Commit the updated `fixtures/mongo-fixture.json` and `fixtures/sqlserver-fixture.json` after harvesting.

### Data Persistence

Both databases persist data to host directories (`mongodb-data/`, `sqlserver-data/`) between runs. Use `npm run e2e:reseed` to reset — do not delete these directories. The SQL seed script drops and recreates all tables; deleting `sqlserver-data/` forces a full server re-initialization (~30s overhead) that is unnecessary.

### Required Cases

The following case IDs must be present in both databases for the specs to pass:

| Case ID | Purpose |
|---------|---------|
| `091-69-12345` | `KNOWN_GOOD_TRANSFER_TO_CASE_ID` — used by case-notes.spec.ts and transfer suggestions |
| `081-65-67641` | `KNOWN_GOOD_TRANSFER_FROM_CASE_ID` — used by transfer-orders.spec.ts |
| `081-18-61881` | Pending transfer order case AND consolidation add-case target |

## Container Architecture

### Build Strategy

The build uses a cached dependency layer to minimize rebuild time:

```
Dockerfile.deps  (rebuilt only when package.json changes — ~5-7 min)
├── System packages
├── Azure Functions Core Tools
└── npm ci (all workspace dependencies)
    ↓
    ├─> Dockerfile.backend   (~30-60 sec — rebuilds source only)
    ├─> Dockerfile.frontend  (~30-60 sec — rebuilds source only)
    └─> Dockerfile.playwright (~30-60 sec — rebuilds source only)
```

| Scenario | Total Time |
|----------|------------|
| First run (no cache) | 8–10 min |
| Subsequent runs (deps cached) | 1–2 min |
| After package.json change | 6–8 min |

Rebuild the deps image only after changing `package.json` files:

```bash
npm run podman:rebuild-deps
```

### Network

- **Backend, Frontend, MongoDB, SQL Server**: Bridge network `cams-e2e`; services address each other by name (e.g., `mongodb:27017`, `sqlserver:1433`, `backend:7071`)
- **Playwright**: Host network mode — connects to `localhost:3000`

Playwright uses host networking because the Okta callback whitelist only includes `http://localhost:3000`, not the internal container hostname.

### Services

| Service | Internal address | Host port |
|---------|-----------------|-----------|
| MongoDB | `mongodb:27017` | 27017 |
| SQL Edge | `sqlserver:1433` | 1433 |
| Backend (Azure Functions) | `backend:7071` | 7071 |
| Frontend (Vite preview) | `frontend:3000` | 3000 |

## Writing Tests

Tests live in `playwright/`. Use the custom `test` fixture from `./fixture/urlQueryString`:

```typescript
import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/case-detail/091-69-12345/notes');
  });

  test('should do something', async ({ page }) => {
    await expect(page.getByTestId('some-element')).toBeVisible({ timeout: 60000 });
  });
});
```

### Best Practices

- Use `data-testid` attributes — more stable than CSS selectors or text
- Always pass an explicit timeout on `expect` calls — containers are slower than local dev
- Use `waitForResponse()` when an action triggers a network request before the next assertion
- Do not add `afterEach` logout — it destroys the Okta server-side session and causes subsequent tests to see a "Session End" page
- The save button in note forms uses a 300ms click throttle; add `page.waitForTimeout(400)` if clicking save immediately after a prior save in the same test

## Debugging

### Backend Logs (Most Useful)

When a test times out waiting for an element, the root cause is often a backend error that never reaches the browser. The workflow script automatically prints the last 100 lines of backend output after any failure. To stream logs live during a test run:

```bash
podman logs -f cams-backend-e2e
```

Look for `[ERROR]` lines — they include the full query, parameters, and the underlying database error.

### Interactive Mode (Local)

```bash
# Start Podman services
npm run podman:services

# In another terminal, run Playwright in UI mode against the running services
npm run test
```

This opens the Playwright Test UI where you can run specific tests, watch the live browser, and step through actions.

### Viewing Traces

Failed tests save traces to `test-results/`. View with:

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

Traces include screenshots, network requests, console logs, and DOM snapshots at each step.

## Troubleshooting

### Tests failing to find elements

- Add an explicit `{ timeout: 60000 }` to the `expect` call
- Check backend logs for errors: `podman logs cams-backend-e2e`
- Use `waitForResponse()` when an action triggers an API call before the next assertion

### Services not starting

```bash
npm run podman:status
npm run podman:logs
npm run podman:rebuild
```

### Deps image missing after `podman:clean`

```bash
npm run podman:rebuild-deps
```

### Port conflicts

If ports 3000, 7071, 27017, or 1433 are already in use, stop the conflicting process or update the host port mappings in `podman-compose.yml`.

### Podman out of disk space

```bash
npm run podman:clean
podman system prune -a
```

### Authentication errors

1. Verify `.env` has correct Okta credentials
2. Confirm `TARGET_HOST=http://localhost:3000` in `.env`
3. Confirm Playwright uses host network mode (`network_mode: host` in `podman-compose.yml`)

### Database connection errors from backend

Verify `.env` has correct values for:
- `MONGO_CONNECTION_STRING` (use `mongodb://mongodb:27017/cams-e2e?retrywrites=false` for containers)
- `MSSQL_HOST` (use `sqlserver` from containers, `localhost` from host)
- `MSSQL_PASS`, `MSSQL_USER`

## Database Reference

### MongoDB

- **Image**: `mongo:7.0` (ARM64 native; used instead of the Cosmos DB Emulator which is x86-only)
- **Database**: `cams-e2e`
- **Collections seeded**: `cases`, `consolidations`, `orders`, `trustees`, `user-groups`
- Trustee documents require a `trusteeId` UUID field — the backend queries by `trusteeId`, not `id`
- Consolidation `memberCases` must not pre-include `081-18-61881` — the consolidation spec adds it via the AddCaseModal

Connect with MongoDB Compass or mongosh:
```
mongodb://localhost:27017/cams-e2e
```

### SQL Server

- **Image**: `mcr.microsoft.com/azure-sql-edge` (ARM64 native; SQL Server itself is x86-only)
- **Database**: `CAMS_E2E`
- **Credentials**: `sa` / `YourStrong!Passw0rd`

Connect with Azure Data Studio, VS Code, or sqlcmd:
```
Server: localhost,1433  |  Auth: SQL Server  |  User: sa  |  Encrypt: No
```

Or from inside the container:
```bash
podman exec -it cams-sqlserver-e2e /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P 'YourStrong!Passw0rd'
```

Key schema facts for seed data maintenance:
- `AO_CS.CS_CASEID` is `VARCHAR(9)` — do not cast to number
- `AO_CS.CASE_ID` is the `year-number` portion only (e.g. `69-12345`), not the full case ID
- `AO_CS_DIV.CS_DIV_ACMS` is the 3-digit division code (`081` = Manhattan, `091` = Buffalo)
- Transfer suggestions (`getSuggestedCases`) match on `AO_PY.PY_TAXID` — the FROM and TO transfer pair must share the same `PY_TAXID`
- `AO_TX` petition code is at `SUBSTRING(REC, 108, 2)` in SQL / `rec.substring(107, 109)` in JS
