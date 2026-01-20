# Running

## Frontend

CAMS is a React application which acts as the main place for oversight work to take place.

Note that any commands listed in this section should be run from the `user-interface` directory.

### <a id="frontend-requirements"></a>Requirements

Node version 18.13.0 or above.

### <a id="frontend-running"></a>Running

If you have never run the application before, major changes have been made since you last ran, or
your `node_modules` folder has been deleted, you will first need to run the following command to
install dependencies:

```shell
npm install
```

To run the application directly, ensure you have met the [prerequisites](#frontend-prerequisites)
and execute:

```shell
npm start
```

This will serve the client on port 3000.

#### <a id="frontend-prerequisites"></a>Prerequisites

You will need to have a file named `.env` placed in the `user-interface` directory. The contents of
that file must be:

```
CAMS_BASE_PATH={the base path of the backend, if any}
CAMS_SERVER_HOSTNAME={the fully qualified domain name (FQDN) of the backend}
CAMS_SERVER_PORT={the port the backend is served on}
CAMS_SERVER_PROTOCOL=http[s]
CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING={optional instrumentation key for extended logging features}
CAMS_USE_FAKE_API={a string: true | false}
CAMS_FEATURE_FLAG_CLIENT_ID={Client-side ID obtained from Launch Darkly}
CAMS_INFO_SHA={expect commit sha used to build current version}
CAMS_LAUNCH_DARKLY_ENV="development"
CAMS_LOGIN_PROVIDER={"okta" || "mock" || "dev" || "none"}
CAMS_LOGIN_PROVIDER_CONFIG=issuer={http://localhost:7071/api/oauth2/default}|clientId={IDP client id if needed} (Replace issuer and clientid with proper okta config for okta)
CAMS_DISABLE_LOCAL_CACHE={true || false}
OKTA_URL={base URL of Okta instance}


```

!> Replace the curly braces and their contents with the appropriate string.

?> `[s]` denotes the `s` should be added to `http` where appropriate or left off where not, no `[`
or `]` should be included.

## Backend

The API for the CAMS application is implemented with Azure Functions written in Node.js.

?> Note that any commands listed in this section should be run from the `backend/` directory.

### <a id="backend-requirements"></a>Requirements

Node version 18.13.0 or above.

### <a id="backend-running"></a>Running

If you have never run the application before, major changes have been made since you last ran, or
your `node_modules` folder has been deleted, you will first need to run the following command to
install dependencies:

```shell
npm run clean:all
npm ci
npm run build:all
```

To run the API function app directly, ensure you have met the
[prerequisites](#backend-prerequisites) and execute:

```shell
npm run start:api
```

This will serve the functions app on port 7071.

To run the `dataflows` function app directly, ensure you have met the
[prerequisites](#backend-prerequisites) and execute:

```shell
npm run start:dataflows
```

#### <a id="backend-prerequisites"></a>Prerequisites

##### .env File

You will need to have a file named `.env` placed in the `backend` directory.

###### Basic Configuration

```
APPLICATIONINSIGHTS_CONNECTION_STRING={optional instrumentation key for extended logging features}
COSMOS_DATABASE_NAME={the name of the CosmosDb database}
MONGO_CONNECTION_STRING={MongoDb connection string}
SERVER_PORT=7071
DATABASE_MOCK={a string: true | false}
CAMS_INFO_SHA=''
```

###### Authentication Configuration

The login provider and configuration must match the frontend to function locally.

```
CAMS_LOGIN_PROVIDER={"okta" || "mock" || "none"}
CAMS_LOGIN_PROVIDER_CONFIG=issuer={http://localhost:7071/api/oauth2/default}|clientId={IDP client id if needed}
```

For Okta, replace the issuer and clientId with proper Okta configuration values.

###### Okta SDK API Configuration

This configuration connects to the Okta Integrator organization. See [Okta Configuration Operations Guide](operations/okta-configuration.md) for details on Okta organization setup.

```
CAMS_USER_GROUP_GATEWAY_CONFIG=url={oktaApiUrl}
OKTA_API_KEY={oktaApiKey}
```

###### SQL Server Configuration

```
MSSQL_HOST={the FQDN of the database}
MSSQL_DATABASE_DXTR={the name of the DXTR database}
MSSQL_ENCRYPT={a string: true | false}
MSSQL_TRUST_UNSIGNED_CERT={a string: true | false}

ACMS_MSSQL_HOST={the FQDN of the ACMS SQL database}
ACMS_MSSQL_DATABASE_DXTR={the name of the ACMS database}
ACMS_MSSQL_ENCRYPT={a string: true | false}
ACMS_MSSQL_TRUST_UNSIGNED_CERT={a string: true | false}
```

**SQL Authentication (Required for SQL Identity):**

```
MSSQL_USER={the SQL Server Admin username}
MSSQL_PASS={the SQL Server Admin user password}
ACMS_MSSQL_USER={the ACMS SQL Server Admin username}
ACMS_MSSQL_PASS={the ACMS SQL Server Admin user password}
```

**Managed Identity Authentication (Optional):**

```
MSSQL_CLIENT_ID={OPTIONAL client id of Managed Identity with access}
ACMS_MSSQL_CLIENT_ID={OPTIONAL client id of Managed Identity with access to the ACMS DB}
```

###### Data Flows Configuration

To enable data flows, add/remove the MODULE_NAME of specific data flow modules to the comma-delimited list. Replace hyphens with underscores in module names.

```
CAMS_ENABLED_DATAFLOWS=SYNC_CASES,SYNC_OFFICE_STAFF,SYNC_ORDERS
```

---

!> Replace the curly braces and their contents with the appropriate string.

!> If you do not have access to the admin password, ask an `owner` of the SQL Server resource in Azure for the value.

?> Note that when you run `npm run start:api` or `npm run start:dataflows`, the script will copy `backend/.env` into the appropriate directory, quietly overwriting any changes made to previous copies. All changes should be handled in `backend/.env` to avoid frustration and misconfiguration.

##### Local MongoDB Setup with Docker

For local development, CAMS supports running MongoDB in a Docker container instead of connecting to Azure Cosmos DB. This provides faster development cycles, offline capability, and eliminates the risk of accidentally modifying shared development databases.

###### Quick Start

1. Ensure Docker and Docker Compose are installed on your system
2. Start the local MongoDB container:
   ```shell
   npm run docker:up
   ```
3. Load seed data:
   ```shell
   npm run seed:local-db
   ```
4. Start the backend:
   ```shell
   npm run start:backend
   ```

###### Configuration

The local MongoDB setup uses the following defaults:
- **Host**: `localhost`
- **Port**: `27017`
- **Database**: `cams`
- **Username**: `cams-admin`
- **Password**: `cams-local-dev-password`

Update your `backend/.env` file with the local connection string:

```
MONGO_CONNECTION_STRING=
COSMOS_DATABASE_NAME=cams
DATABASE_MOCK=false
```

A template configuration is available at `backend/.env.local.example`.

###### Managing the Local Database

**Start MongoDB:**
```shell
npm run docker:up
```

**Stop MongoDB (preserves data):**
```shell
npm run docker:down
```

**Stop MongoDB and delete all data:**
```shell
npm run docker:down:volumes
```

**View MongoDB logs:**
```shell
npm run docker:logs
```

**Reload seed data:**
```shell
npm run seed:local-db
```

###### Seed Data

The seed data loader reuses the existing E2E test infrastructure and loads:
- Cases from the DXTR database
- Transfer and consolidation orders
- Trustees
- User groups
- Office staff

?> The seed script requires a connection to the DXTR SQL database. Ensure your DXTR credentials are configured in `backend/.env` before running `npm run seed:local-db`.

###### Viewing Data

You can connect to the local MongoDB using MongoDB Compass or mongosh:

```shell
mongosh "mongodb://localhost:27017/cams" -u cams-admin -p cams-local-dev-password --authenticationDatabase admin
```

###### Troubleshooting

**MongoDB container won't start:**
- Check if port 27017 is already in use: `lsof -i :27017`
- Check Docker logs: `npm run docker:logs`

**Seed data not loading:**
- Ensure MongoDB is running: `docker ps | grep cams-mongodb`
- Verify DXTR database credentials are correct in `backend/.env`
- Check that `LOAD_E2E_DB` is in `CAMS_ENABLED_DATAFLOWS`

**Connection refused errors:**
- Wait a few seconds after `npm run docker:up` for MongoDB to fully start
- Check MongoDB health: `docker inspect cams-mongodb | grep Health`

###### Using Azure Cosmos DB Instead

If you need to connect to Azure Cosmos DB for local development, simply update the `MONGO_CONNECTION_STRING` in `backend/.env` to your Azure Cosmos DB connection string. No code changes are required.

##### Cosmos Database

To interact with the Cosmos database from your local machine you will need to set up access
separately. One way to do this is by setting up
[role based access](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-setup-rbac).

##### SQL Server Database

###### Password-less connection (via Azure User Managed Identity)

Existing Bicep deployment can automate the creation of the user managed identity and assign the
identity to the Function App instance. The below are some manual steps to handle.

Grant access to a managed identity with the following sql query

```sql
CREATE USER [userAssignedIdentityName] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [userAssignedIdentityName];
-- Remember to leverage principle of least privilege
-- ALTER ROLE db_datawriter ADD MEMBER [userAssignedIdentityName];
-- ALTER ROLE db_ddladmin ADD MEMBER [userAssignedIdentityName];
GO
```

Also ensure to set the MSSQL_CLIENT_ID environment variable for the Function App. This is stored as
a secret in Key Vault.

##### Azure Functions Core

You will need to have the
[Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Cmacos%2Ccsharp%2Cportal%2Cbash#install-the-azure-functions-core-tools)
installed.

##### Local Settings File

You must have a file named `local.settings.json` placed in each of the `backend/function-apps/api`
and `backend/function-apps/dataflows` directories.

The contents of these files must be:

`backend/function-apps/api`

```
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "--SEE AzureWebJobsStorage BELOW--"
  },
  "ConnectionStrings": {},
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*"
  }
}
```

`backend/function-apps/dataflows`

```
{
  "IsEncrypted": false,
  "Values": {
    "MyTaskHub": "--A NAME UNIQUE TO YOU--",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "--SEE AzureWebJobsStorage BELOW--"
  },
  "ConnectionStrings": {},
  "Host": {
    "LocalHttpPort": 7072,
    "CORS": "*"
  }
}
```

###### AzureWebJobsStorage

A sufficiently privileged user can retrieve the `AzureWebJobsStorage` connection string for the
`api` and `dataflows` function apps with the following Azure CLI command:

```sh
az functionapp config appsettings list -g {resource-group-name} -n {function-app-name} --query "[?name=='AzureWebJobsStorage']"
```

Replace `{resource-group-name}` and `{function-app-name}` with their respective values in the
command above.

##### Triggering Dataflow Functions with HTTP Triggers Locally

Ensure the desired data flow is enabled via the `CAMS_ENABLED_DATAFLOWS` environment variable. Separate two or more than one data
flow names with commas.
```shell
export CAMS_ENABLED_DATAFLOWS=<data-flow-names>
```

###### Example:
###### CAMS_ENABLED_DATAFLOWS=SYNC_OFFICE_STAFF,SYNC_ORDERS

The `data-flow-name` is a list of `MODULE_NAME` values from the function definitions in `backend/function-apps/input` or `backend/function-apps/migrations` for the function(s) being tested.

Available migration dataflows include:
- `MIGRATE_ASSIGNEES` - Migrate office staff assignments
- `MIGRATE_CASES` - Migrate cases from ACMS to Cosmos
- `MIGRATE_CHILDCASES_TO_MEMBERCASES` - One-time migration to rename childCases field to memberCases in consolidation orders
- `MIGRATE_CONSOLIDATIONS` - Migrate consolidation orders from ACMS to Cosmos

Run the data flow functions from the `backend` node project:

```shell
npm run start:dataflows
```

Use `curl` -- or your favorite API testing tool -- to send an HTTP request to local Azure
Function http trigger endpoints.

```shell
curl -H "Content-Type: application/json" \
     -H "Authorization: ApiKey <redacted-key>" \
     -X POST -d "<any-required-json>" \
     http://localhost:7072/<base-path>/<route>
```

The `<redacted-key>` is the value of the `ADMIN_KEY` environment variable used when the functions are started.

The `<any-required-json>` is specific to each given HTTP trigger, but is typically an empty object literal.

The `<base-path>` is `input` or `migrations` named after the directory the Azure Function is defined in `backend/function-apps`.

The `<route>` is the route registered in the Azure Function's HTTP trigger setup. Look for the `route` property on the `app.http` configuration found in the `setup` function in the function definition. For example, the `<route>` would be `sync-cases` given the following `app.http` configuration:
```ts
app.http(HTTP_TRIGGER, {
  route: 'sync-cases',
  methods: ['POST'],
});
```

See also:
[Code and test Azure Functions locally](https://learn.microsoft.com/en-us/azure/azure-functions/functions-develop-local)

## These Docs

These docs are hosted on GitHub Pages using [Docsify](https://docsify.js.org/). To run them locally
to validate changes run the following command:

```shell
docsify serve [path] [--open false] [--port 3000]
```

?> Note that `[]` denote optional portions of the command and are not intended to be included in the
actual command you run. For further information about how to use the command line interface see
[their docs](https://github.com/docsifyjs/docsify-cli).
