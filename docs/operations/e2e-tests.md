# End-2-End Tests

## .env file

To run E2E tests on the CAMS app from your local machine, you will require a .env file within the test/e2e/ directory with the following contents:

- `authFile="playwright/.auth/user.json"`
- `TARGET_HOST=http://localhost:3000`
- `CAMS_LOGIN_PROVIDER = "mock | okta | none"`
- `OKTA_USER_NAME=<if provider is okta>`
- `OKTA_PASSWORD=<if provider is okta>`

## Installation

In order to run playwright locally you will need to install playwright with the project dependencies. That can be done from your terminal within the test/e2e/ directory:

`npx playwright install --with-deps`

## Running E2E Tests

### Setup for running against locally hosted application

- When running playwright against the locally hosted application, you will want to ensure the NodeApi is running against a clean e2e database or the database needed for testing. `COSMOS_DATABASE_NAME=cams-e2e-<envHash>`
- run the application locally [Running](../running.md)
- ensure your test/e2e/ .env file has `TARGET_HOST=http://localhost:3000`
- ensure your test/e2e/ .env file has `CAMS_LOGIN_PROVIDER=mock`

### Running against Deployed Environment

- ensure your test/e2e/ .env file has `TARGET_HOST=https://<targetEnvironmentUrl>`
- ensure `CAMS_LOGIN_PROVIDER=<targetEnvironmentLoginProvider>`
- ensure `OKTA_USER_NAME=<targetEnvUser> OKTA_PASSWORD=<targetEnvUserPass>` are set for the proper environment

### Executing the Tests

- Run Headless: within test/e2e/ `npm run headless`
- Run with playwright UI: within test/e2e/ `npm run ui`
