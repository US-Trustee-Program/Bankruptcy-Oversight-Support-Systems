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
CAMS_PA11Y={a string: true | false}
CAMS_FEATURE_FLAG_CLIENT_ID={Client-side ID obtained from Launch Darkly}
CAMS_INFO_SHA={expect commit sha used to build current version}
CAMS_LAUNCH_DARKLY_ENV="development"
CAMS_LOGIN_PROVIDER={"okta" || "mock" || "none"}
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

You will need to have a file named `.env` placed in the `backend` directory. The contents of that
file must be:

```
APPLICATIONINSIGHTS_CONNECTION_STRING={optional instrumentation key for extended logging features}
COSMOS_DATABASE_NAME={the name of the CosmosDb database}
MONGO_CONNECTION_STRING={MongoDb connection string}
SERVER_PORT=7071

## LOGIN_PROVIDER and CONFIG must match the frontend to function locally
CAMS_LOGIN_PROVIDER_CONFIG=issuer={http://localhost:7071/api/oauth2/default}|clientId={IDP client id if needed} (Replace issuer and clientid with proper okta config for okta)
CAMS_LOGIN_PROVIDER={"okta" || "mock" || "none"}

## OKTA SDK API CONFIGURATION
## Two options. Use one option not both.
## CAMS_USER_GROUP_GATEWAY_CONFIG is a pipe delimited list. Replace curly braces and content with your values.
## Option 1: Private Key Authentication
## {privateKeyJSON} must be stripped of all whitespace
CAMS_USER_GROUP_GATEWAY_CONFIG='url={oktaApiUrl}|clientId={oktaClientId}|keyId={publicKeyId}|privateKey={privateKeyJSON}'
## End Option 1
## Option 2: API Key Authentication
CAMS_USER_GROUP_GATEWAY_CONFIG=url={oktaApiUrl}
OKTA_API_KEY={oktaApiKey}
## End Option 2

DATABASE_MOCK={a string: true | false}
CAMS_INFO_SHA=''
MSSQL_HOST={the FQDN of the database}
MSSQL_DATABASE_DXTR={the name of the DXTR database}
MSSQL_ENCRYPT={a string: true | false}
MSSQL_TRUST_UNSIGNED_CERT={a string: true | false}

ACMS_MSSQL_HOST={the FQDN of the ACMS SQL database}
ACMS_MSSQL_DATABASE_DXTR={the name of the ACMS database}
ACMS_MSSQL_ENCRYPT={a string: true | false}
ACMS_MSSQL_TRUST_UNSIGNED_CERT={a string: true | false}

# Required for SQL Auth. Required for connecting to SQL with SQL Identity.
MSSQL_USER={the SQL Server Admin username}
MSSQL_PASS={the SQL Server Admin user password}
ACMS_MSSQL_USER={the ACMS SQL Server Admin username}
ACMS_MSSQL_PASS={the ACMS SQL Server Admin user password}
# Required for connecting to CAMS SQL server database with managed identity
MSSQL_CLIENT_ID={OPTIONAL client id of Managed Identity with access}
ACMS_MSSQL_CLIENT_ID={OPTIONAL client id of Managed Identity with access to the ACMS DB}

## Required to enable data flows. Add/Remove the MODULE_NAME of specific data flow modules
## to the comma-delimited list in the CAMS_ENABLED_DATAFLOWS variable.
# CAMS_ENABLED_DATAFLOWS=SYNC-CASES,SYNC-OFFICE-STAFF,SYNC-ORDERS
```

!> Replace the curly braces and their contents with the appropriate string.

!> If you do not have access to the admin password, ask an `owner` of the SQL Server resource in
Azure for the value

?> Note that when you run `npm run start:api` or `npm run start:dataflows`, the script will copy `backend/.env` into the appropriate directory, quietly overwriting any changes made to previous copies. All changes should be handled in `backend/.env` to avoid frustration and misconfiguration.

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

##### Running Administrative Functions Locally

Admin Endpoint Pattern: `http://localhost:{port}/api/{function_name}`

Use `curl` or your favorite API testing tool to send an HTTP request to following local Azure
Function admin endpoints:

```sh
# For the `orders-sync` function:
curl -d "{}" -H "Content-Type: application/json" -X POST http://localhost:7071/api/orders-sync

# For the `admin` function `deleteMigrations`:
curl -d "{\"apiKey\": \"{the admin key}\"}" -X DELETE http://localhost:7071/api/dev-tools/deleteMigrations

# Data Migration
curl -d "(see below)" -H "Content-Type: application/json" -X POST http://localhost:7071/dataflows/consolidation
```

Possible data for dataflows (example):

```json
{
  "apiKey": "{the admin key}",
  "chapters": ["11", "15"],
  "divisionCodes": ["081"]
}
```

See:
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
