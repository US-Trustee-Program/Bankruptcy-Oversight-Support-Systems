# CAMS End-to-End Testing

Automated browser-based testing using Playwright to verify the complete CAMS application stack.

## Quick Start

**Recommended: Complete Orchestrated Workflow** (One command does everything!)

```bash
cd test/e2e

# First time: Install Podman dependencies
npm run podman:install

# Run complete workflow: startup → test → report → teardown
npm run e2e                # Uses existing database, report in terminal
npm run e2e:reseed         # Clear and reseed database (first run or data issues)
npm run e2e:open           # Run tests and open HTML report in browser
npm run e2e:full           # Reseed database + open report (complete workflow)
```

This single command:
- ✅ Starts MongoDB container (~10 seconds)
- ✅ Starts Azure SQL Edge container (~30 seconds)
- ✅ Starts backend and frontend services
- ✅ Waits for services to be healthy
- ✅ Uses existing database data (or reseeds with --reseed flag)
- ✅ Runs all E2E tests
- ✅ Shows test report summary in terminal
- ✅ Displays logs on failure
- ✅ Optionally opens HTML report in browser (--open-report flag)
- ✅ Tears down services automatically

**Options**:
- **Databases**: By default preserves existing data (faster). Use `--reseed` to clear and reseed MongoDB + SQL Server with fresh test data
- **Report**: By default shows summary in terminal. Use `--open-report` to open HTML report in browser

See [GETTING-STARTED.md](./GETTING-STARTED.md) for complete Podman workflow guide.

## Testing Approaches

### 🐳 Podman (Recommended)

**Pros:**
- ✅ One command to run everything
- ✅ No local dependencies (except Podman)
- ✅ Consistent environment across all developers
- ✅ CI/CD ready
- ✅ Automatic service coordination

**Quick commands:**
```bash
npm run podman:install       # Install Podman dependencies (first time)
npm run podman:rebuild-deps  # Build deps image (first time or after package.json changes)
npm run e2e                  # Run E2E workflow (uses existing data, terminal report)
npm run e2e:reseed           # Run with fresh database seed
npm run e2e:open             # Run and open HTML report in browser
npm run e2e:full             # Full workflow: reseed + open report
npm run podman:services      # Start services for manual testing
npm run podman:clean         # Clean up all images and test results
npm run --list               # See all commands
```

**Documentation:**
- [GETTING-STARTED.md](./GETTING-STARTED.md) - Step-by-step guide
- [README.podman.md](./README.podman.md) - Podman architecture and optimization details
- [MONGODB.md](./MONGODB.md) - MongoDB setup, seeding, and troubleshooting
- [SQLSERVER.md](./SQLSERVER.md) - Azure SQL Edge setup and seeding

### 💻 Local Development

**Pros:**
- Faster iteration during test development
- Direct access to source code
- Can debug with breakpoints

**Requirements:**
- Node.js 20
- Azure Functions Core Tools
- Three separate terminal windows

**Setup:**
```bash
# Terminal 1: Backend
cd backend/function-apps/api
npm run start

# Terminal 2: Frontend
cd user-interface
npm run start

# Terminal 3: Tests
cd test/e2e
npm run test        # Interactive mode
npm run headless    # Headless mode
```

## Project Structure

```
test/e2e/
├── playwright/                    # Test files
│   ├── consolidation-orders.spec.ts
│   ├── transfer-orders.spec.ts
│   └── ...
├── fixtures/
│   ├── mongo-fixture.json         # Committed test data for MongoDB (no PII)
│   └── sqlserver-fixture.json     # Committed test data for SQL Server (no PII)
├── scripts/
│   ├── seed-database.ts           # Seeds MongoDB from mongo-fixture.json
│   ├── seed-sqlserver.ts          # Seeds SQL Edge from sqlserver-fixture.json
│   ├── harvest-fixtures.sh        # Re-harvests fixture files from live sources
│   ├── harvest-mongo.ts           # Dumps live e2e MongoDB → mongo-harvested.json
│   ├── harvest-sqlserver.ts       # Pulls DXTR SQL rows → sqlserver-harvested.json
│   ├── synthesize-fixtures.ts     # Builds committed fixtures from harvested files
│   ├── run-e2e-workflow.sh        # Orchestrates the full e2e run
│   └── install-podman.sh          # Install Podman dependencies
├── playwright.config.ts           # Playwright configuration
├── podman-compose.yml             # Podman orchestration
├── Dockerfile.backend             # Backend container
├── Dockerfile.frontend            # Frontend container
├── Dockerfile.playwright          # Test runner container
├── package.json                   # npm scripts
├── .env                          # Environment configuration (not committed)
├── GETTING-STARTED.md            # Getting started guide
├── MONGODB.md                    # MongoDB setup and seeding details
└── SQLSERVER.md                  # SQL Edge setup and seeding details

test-results/                     # Test artifacts (gitignored)
playwright-report/                # HTML test report (gitignored)
fixtures/*-harvested.json         # Intermediate harvest files (gitignored)
```

## Available Commands

### Running Tests

```bash
npm run e2e               # Run tests using existing database data (fast)
npm run e2e:reseed        # Clear and reseed databases, then run tests
npm run e2e:open          # Run tests and open HTML report in browser
npm run e2e:full          # Reseed + run tests + open report
```

### Seeding Databases

```bash
npm run seed              # Seed MongoDB from fixtures/mongo-fixture.json
npm run seed:sql          # Seed SQL Edge from fixtures/sqlserver-fixture.json
npm run seed:all          # Seed both databases
```

### Updating Fixture Files

Fixtures are committed to the repo and only need updating when the underlying test data
changes in the source databases. Requires DXTR credentials in `.env`.

```bash
npm run harvest           # Dump e2e MongoDB + pull SQL from DXTR → rebuild fixtures
npm run harvest:reseed    # Re-seed MongoDB from DXTR first, then harvest (full refresh)
```

See [MONGODB.md](./MONGODB.md) and [SQLSERVER.md](./SQLSERVER.md) for details.

### Podman Infrastructure

```bash
npm run podman:install    # Install Podman dependencies (first time)
npm run podman:services   # Start services for manual testing
npm run podman:debug      # Start services with logs
npm run podman:logs       # View service logs
npm run podman:status     # Check service status
npm run podman:clean      # Clean up containers and volumes
npm run podman:rebuild    # Rebuild containers
npm run podman:down       # Stop services
npm run report            # View test report
```

### Local (without Podman)

```bash
npm run test        # Interactive mode with UI
npm run headless    # Headless mode (CI)
npm run report      # View test report
```

## Configuration

### Environment Variables

Configuration is in `.env` file:

```bash
# Application endpoint
TARGET_HOST=http://localhost:3000

# Authentication
CAMS_LOGIN_PROVIDER=okta
OKTA_USER_NAME=camsdeve2e@flexion.us
OKTA_PASSWORD=...

# Databases
COSMOS_DATABASE_NAME=cams-e2e
MONGO_CONNECTION_STRING=...
MSSQL_HOST=...
```

**Note:** Podman automatically uses this `.env` file for all services.

### Playwright Configuration

See `playwright.config.ts` for:
- Timeouts
- Retries
- Browsers (Chromium, Edge)
- Parallelization settings

## Writing Tests

Tests are in the `playwright/` directory. Example structure:

```typescript
import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup
    await page.goto('/data-verification');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
    await expect(page.getByTestId('element')).toBeVisible();
  });
});
```

### Best Practices

1. **Use data-testid attributes** - More stable than CSS selectors
2. **Wait for data to load** - Use `waitForResponse()` for API calls
3. **Use beforeEach for setup** - Keep tests isolated
4. **Clean up in afterEach** - Logout, reset state
5. **Descriptive test names** - Clearly state what's being tested

## Viewing Test Results

### HTML Report

```bash
npm run report
# or
npx playwright show-report
```

### Traces

For failed tests, traces are saved to `test-results/`. View with:

```bash
npx playwright show-trace test-results/path-to-trace.zip
```

Traces include:
- Screenshots at each step
- Network requests
- Console logs
- DOM snapshots

## Debugging

### Interactive Mode (Local)

```bash
npm run test
```

This opens Playwright Test UI where you can:
- Run specific tests
- See live browser
- Step through actions
- Inspect elements

### Debug in Podman

```bash
# Start services
npm run podman:services

# Run tests locally against Podman services
npm run test
```

### View Logs

```bash
# All services
npm run podman:logs

# Specific service
podman-compose logs -f backend
podman-compose logs -f frontend
```

## CI/CD

The Podman setup is designed for CI/CD. Example:

```yaml
# GitHub Actions
- name: Run E2E Tests
  run: |
    cd test/e2e
    podman-compose up --build --abort-on-container-exit --exit-code-from playwright
```

Tests will:
- Build containers
- Start services
- Run tests
- Report results
- Exit with appropriate code

## Troubleshooting

### Tests failing to find elements

Check timing:
- Are you waiting for API responses?
- Is the element conditionally rendered?
- Add `waitForResponse()` or increase timeouts

### Services not starting (Podman)

```bash
# Check status
npm run podman:status

# View logs
podman-compose logs backend
podman-compose logs frontend

# Rebuild
npm run podman:rebuild
```

### Port conflicts

If ports 3000 or 7071 are in use:
- Stop other services
- Or modify `podman-compose.yml` port mappings

### Tests timing out or showing blank pages

Playwright can only report what the browser sees. When a test times out waiting for an
element, the root cause is often a backend API error that never reaches the browser — for
example, a SQL query failing silently and returning a 500.

The backend API log is the most reliable diagnostic tool in the E2E stack. The workflow
script automatically prints the last 100 lines of backend output after any test failure,
but you can also stream it live while tests run:

```bash
podman logs -f cams-backend-e2e
```

Look for `[ERROR]` lines — they include the full query, parameters, and the underlying
database error message. This is far more informative than any Playwright timeout or
browser screenshot.

### Database connection issues

Verify `.env` has correct:
- `MONGO_CONNECTION_STRING`
- `MSSQL_HOST`, `MSSQL_USER`, `MSSQL_PASS`

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [GETTING-STARTED.md](./GETTING-STARTED.md) - Detailed Podman guide
- [README.podman.md](./README.podman.md) - Podman architecture
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## Support

- **Podman issues**: Check [README.podman.md](./README.podman.md) troubleshooting section
- **Test issues**: Run with `npm run test` for interactive debugging
- **Environment issues**: Verify `.env` configuration
