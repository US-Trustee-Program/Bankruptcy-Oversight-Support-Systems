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
```

!> Replace the curly braces and their contents with the appropriate string.

?>`[s]` denotes the `s` should be added to `http` where appropriate or left off where not, no `[` or
`]` should be included.

## Backend

The API for the CAMS application is implemented with Azure Functions written in Node.js.

Note that any commands listed in this section should be run from the `backend/functions` directory.

### <a id="backend-requirements"></a>Requirements

Node version 18.13.0 or above.

### <a id="backend-running"></a>Running

If you have never run the application before, major changes have been made since you last ran, or
your `node_modules` folder has been deleted, you will first need to run the following command to
install dependencies:

```shell
npm install
```

To run the functions app directly, ensure you have met the [prerequisites](#backend-prerequisites)
and execute:

```shell
npm start
```

This will serve the functions app on port 7071.

#### <a id="backend-prerequisites"></a>Prerequisites

##### .env File

You will need to have a file named `.env` placed in the `backend/functions` directory. The contents
of that file must be:

```
APPLICATIONINSIGHTS_CONNECTION_STRING={optional instrumentation key for extended logging features}

COSMOS_DATABASE_NAME={the name of the CosmosDb database}
COSMOS_ENDPOINT={the URI to the CosmosDb endpoint}
COSMOS_MANAGED_IDENTITY=

DATABASE_MOCK={a string: true | false}

MSSQL_HOST={the FQDN of the database}
MSSQL_DATABASE_DXTR={the name of the DXTR database}
MSSQL_ENCRYPT={a string: true | false}
MSSQL_TRUST_UNSIGNED_CERT={a string: true | false}
# Required for SQL Auth. Recommended alternative is to use managed identities.
MSSQL_USER={the SQL Server Admin username}
MSSQL_PASS={the SQL Server Admin user password}
# Required for connecting to CAMS SQL server database
MSSQL_CLIENT_ID={OPTIONAL client id of Managed Identity with access}

STARTING_MONTH={number of months previous to today to use as a starting month (defaults to 6)}
```

!> Replace the curly braces and their contents with the appropriate string.

!> If you do not have access to the admin password, ask an `owner` of the SQL Server resource in
Azure for the value

##### Cosmos Database

To interact with the Cosmos database from your local machine you will need to set up
access separately. One way to do this is by setting up
[role based access](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-setup-rbac).

##### SQL Server Database

###### Passwordless connection (via Azure User Managed Identity)

Existing Bicep deployment can automate the creation of the user managed identity and assign the identity to the functionapp instance. The below are some manual steps to handle.

Grant access to a managed identity with the following sql query
```sql
CREATE USER [userAssignedIdentityName] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [userAssignedIdentityName];
-- Remember to leverage principle of least privilege
-- ALTER ROLE db_datawriter ADD MEMBER [userAssignedIdentityName];
-- ALTER ROLE db_ddladmin ADD MEMBER [userAssignedIdentityName];
GO
```

Also ensure to set the environment variable for the functionapp, MSSQL_CLIENT_ID. This is stored as a secret in Keyvault.

##### Azure Functions Core

You will need to have the
[Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Cmacos%2Ccsharp%2Cportal%2Cbash#install-the-azure-functions-core-tools)
installed.

##### Local Settings File

You will need to have a file named local.settings.json placed in the `backend/functions` directory. The
contents of that file must be:

```
{
    "Host": {
        "CORS": "*"
    }
}
```

## These Docs

These docs are hosted on GitHub Pages using [Docsify](https://docsify.js.org/). To run them locally to validate changes run the following command:

```shell
docsify serve docs [path] [--open false] [--port 3000]
```

?> Note that `[]` denote optional portions of the command and are not intended to be included in the actual command you run. For further information about how to use the command line interface see [their docs](https://github.com/docsifyjs/docsify-cli).
