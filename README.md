# Bankruptcy Oversight Support Systems (BOSS)

## [United States Trustee Program](https://www.justice.gov/ust)

The United States Trustee Program is the component of the Department of Justice responsible for overseeing the administration of bankruptcy cases and private trustees under 28 U.S.C. § 586 and 11 U.S.C. § 101, et seq. We are a national program with broad administrative, regulatory, and litigation/enforcement authorities whose mission is to promote the integrity and efficiency of the bankruptcy system for the benefit of all stakeholders–debtors, creditors, and the public. The USTP consists of an Executive Office in Washington, DC, and 21 regions with 90 field office locations nationwide.

[Learn More](https://www.justice.gov/ust/about-program)

# Applications

## Frontend

BOSS is a React application which acts as the main place for oversight work to take place.

Note that any commands listed in this section should be run from the `gui` directory.

### Requirements

Node version 18.13.0 or above.

### Running

If you have never run the application before, major changes have been made since you last ran, or your `node_modules` folder has been deleted, you will first need to run the following command to install dependencies:

```shell
npm install
```

To run the application directly, execute:

```shell
npm start
```

This will serve the client on port 3000.

#### Prerequisites

You will need to have a file named `.env` placed in the `gui` directory. The contents of that file must be:

```
REACT_APP_BASE_PATH={the base path of the backend, if any}
REACT_APP_SERVER_HOSTNAME={the TLD of the backend}
REACT_APP_SERVER_PORT={the port the backend is served on}
REACT_APP_SERVER_PROTOCOL=http[s]
```

> NOTE:
> - Replace the curly braces and their contents with the appropriate string.
> - `[s]` denotes the `s` should be added to `http` where appropriate or left off where not, no `[` or `]` should be included.

## Backend

Multiple options for the backend are being evaluated.

### Node Webservice

A webservice implemented in Node can be found in the `api/node` directory.

Note that any commands listed in this section should be run from the `api/node` directory.

#### Requirements

Node version 18.13.0 or above.

#### Running

If you have never run the application before, major changes have been made since you last ran, or your `node_modules` folder has been deleted, you will first need to run the following command to install dependencies:

```shell
npm install
```

To run the application directly, execute:

```shell
npm run start:dev
```

This will serve the web service on port 8080.

To build and run a production build, execute:

```shell
npm run build
serve -s build
```

#### Prerequisites

You will need to have a file named `.env` placed in the `api/node` directory. The contents of that file must be:

```
MSSQL_HOST=
MSSQL_DATABASE=
MSSQL_USER=
MSSQL_PASS=
MSSQL_ENCRYPT=
MSSQL_TRUST_UNSIGNED_CERT=
AZURE_MANAGED_IDENTITY=
```

### Java Webservice

A webservice implemented in Java can be found in the `api/java` directory.

#### Requirements

Java version 17 or above.

#### Running

Note that any commands listed in this section should be run from the `api/java` directory.

To build the webservice, execute:

```shell
./gradlew build
```

To build a `jar` file, execute:

```shell
./gradlew build jar
```

#### Prerequisites

You will need to provide an environment variable named `password` which is the SQL Server Admin password, used to obtain SQL Authentication.

### Java Function

An Azure Function App implemented in Java.

#### Requirements

Java version 17 or above.

#### Running

Note that any commands listed in this section should be run from the `functions/java` directory.

To build, execute:

```shell
./gradlew build
```

To run the Function locally, execute:

```shell
./gradlew azureFunctionsRun
```

To package the Function for deployment, execute:

```shell
./gradlew azureFunctionsPackageZip
```

#### Prerequisites

You will need to have the [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Cmacos%2Ccsharp%2Cportal%2Cbash#install-the-azure-functions-core-tools) installed.

You will need to have a file named local.settings.json placed in the `functions/java` directory. The contents of that file must be:

```
{
    "IsEncrypted": false,
    "Values": {
        "FUNCTIONS_WORKER_RUNTIME": "java",
        "JAVA_HOME": "{the path to the home directory of the JDK you wish to use}",
        "SQL_SERVER_CONN_STRING": "{the connection string}"
    },
    "Host": {
        "CORS": "*"
    }
}
```

# Contributing

## Style and Secrets Enforcement

[pre-commit](https://pre-commit.com) allows us to make use of hooks that enforce style and prevent secrets from being committed to the repo. As such, it is expected that all code pushed to the repository have had these pre-commit hooks executed on all files created or updated. The configuration can be seen in `.pre-commit-config.yaml`.

`pre-commit` must be installed locally on your development machine to enable the hooks to be run. Please follow the [install instructions](https://pre-commit.com/index.html#installation) and allow these hooks to run on all commits.

[`pre-commit.ci`](https://pre-commit.ci/) is provided free for open-source repositories ([see here](https://pre-commit.ci/#pricing)) and allows us to leverage `pre-commit` in our continuous integration (CI) process. Configuration is handled in `.pre-commit-config.yaml`.

### Possible Issue with pre-commit

When you install `pre-commit`, your package manager may install an older version such as `1.1.0`. There is a [known issue](https://github.com/Yelp/detect-secrets/issues/452) with that specific version and newer versions of Python. If in the execution of your pre-commit hooks you encounter an error like the following, you may need to update your version of `pre-commit`.

> [scan]  ERROR   No plugins to scan with!
