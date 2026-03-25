# End-2-End Tests

## Option 1: Containerized Testing with Podman

Run E2E tests using the containerized Podman environment. This approach:
- ✅ Requires no local backend/frontend setup
- ✅ Provides consistent environment across all developers
- ✅ Handles service orchestration automatically
- ✅ Opens test report in browser automatically

### Quick Start

```bash
cd test/e2e

# First time: Install Podman (if not already installed)
npm run podman:install

# First time: Build dependency cache
npm run podman:rebuild-deps

# Run complete E2E workflow
npm run e2e
```

The workflow will:
1. Build/start backend and frontend containers
2. Wait for services to be healthy
3. Run all E2E tests
4. Display test summary
5. Open HTML report in browser
6. Clean up containers

See [test/e2e/README.md](../../test/e2e/README.md) for complete Podman documentation.

### .env file for Containerized Testing

Create `test/e2e/.env` with:

```bash
TARGET_HOST=http://localhost:3000
CAMS_LOGIN_PROVIDER=okta
OKTA_USER_NAME=<your-okta-username>
OKTA_PASSWORD=<your-okta-password>

# Database configuration (use e2e database)
COSMOS_DATABASE_NAME=cams-e2e
MONGO_CONNECTION_STRING=<cosmos-connection-string>
DATABASE_MOCK=false

# SQL Server configuration
MSSQL_HOST=<sql-server-host>
MSSQL_DATABASE_DXTR=<database-name>
MSSQL_USER=<sql-username>
MSSQL_PASS=<sql-password>
MSSQL_ENCRYPT=true
MSSQL_TRUST_UNSIGNED_CERT=true

SLOT_NAME=local
```

## Option 2: Local Testing (Non-Containerized)

Run tests against locally-hosted services:

### .env file

Create `test/e2e/.env` with:

- `authFile="playwright/.auth/user.json"`
- `TARGET_HOST=http://localhost:3000`
- `CAMS_LOGIN_PROVIDER = "mock | okta | none"`
- `OKTA_USER_NAME=<if provider is okta>`
- `OKTA_PASSWORD=<if provider is okta>`

### Installation

Install Playwright with browser dependencies:

```bash
cd test/e2e
npx playwright install --with-deps
```

### Setup for running against locally hosted application

- When running playwright against the locally hosted application, you will want to ensure the NodeApi is running against a clean e2e database or the database needed for testing, and has the following .env values within backend/function : `COSMOS_DATABASE_NAME=cams-e2e-<envHash> CAMS_LOGIN_PROVIDER=mock`
- Within the user-interface/.env file you will need `CAMS_LOGIN_PROVIDER=mock`
- For other configuration and to run the application locally [See Running...](../running.md)
- ensure your test/e2e/ .env file has `TARGET_HOST=http://localhost:3000`
- ensure your test/e2e/ .env file has `CAMS_LOGIN_PROVIDER=mock`

### Running against Deployed Environment

- ensure your test/e2e/ .env file has `TARGET_HOST=https://<targetEnvironmentUrl>`
- ensure `CAMS_LOGIN_PROVIDER=<targetEnvironmentLoginProvider>`
- ensure `OKTA_USER_NAME=<targetEnvUser> OKTA_PASSWORD=<targetEnvUserPass>` are set for the proper environment

### Executing the Tests

- Run Headless: within test/e2e/ `npm run headless`
- Run with playwright UI: within test/e2e/ `npm run ui`
