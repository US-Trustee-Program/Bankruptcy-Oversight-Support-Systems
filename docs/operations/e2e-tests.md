# End-2-End Tests

## .env file

To run E2E tests on the CAMS app from your local machine, you will require a .env file within the test/e2e/ directory with the following contents:

`authFile="playwright/.auth/user.json"
TARGET_HOST=http://localhost:3000
CAMS_LOGIN_PROVIDER = 'mock | okta | none'
OKTA_USER_NAME=<if provide is okta>
OKTA_PASSWORD=<if provider is okta>`

## Installation

In order to run playwright locally you will need to install playwright with the project dependencies. That can be done from your terminal within the test/e2e/ directory:

`npx playwright install --with-deps`

## Running against Local Host

- When running playwright against the locally hosted application, you will wnt to ensure the NodeApi is running against a clean e2e database or the database needed for testing
- ensure your test/e2e/ .env file has `TARGET_HOST=http://localhost:3000`
