# CAse Management System (CAMS)

## [United States Trustee Program](https://www.justice.gov/ust)

The United States Trustee Program is the component of the Department of Justice responsible for overseeing the administration of bankruptcy cases and private trustees under 28 U.S.C. § 586 and 11 U.S.C. § 101, et seq. We are a national program with broad administrative, regulatory, and litigation/enforcement authorities whose mission is to promote the integrity and efficiency of the bankruptcy system for the benefit of all stakeholders–debtors, creditors, and the public. The USTP consists of an Executive Office in Washington, DC, and 21 regions with 90 field office locations nationwide.

[Learn More](https://www.justice.gov/ust/about-program)

# Applications

## Frontend

CAMS is a React application which acts as the main place for oversight work to take place.

Note that any commands listed in this section should be run from the `gui` directory.

### <a id="frontend-requirements"></a>Requirements

Node version 18.13.0 or above.

### <a id="frontend-running"></a>Running

If you have never run the application before, major changes have been made since you last ran, or your `node_modules` folder has been deleted, you will first need to run the following command to install dependencies:

```shell
npm install
```

To run the application directly, ensure you have met the [prerequisites](#frontend-prerequisites) and execute:

```shell
npm start
```

This will serve the client on port 3000.

#### <a id="frontend-prerequisites"></a>Prerequisites

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

The API for the CAMS application is implemented with Azure Functions written in Node.js.

Note that any commands listed in this section should be run from the `functions/node` directory.

### <a id="backend-requirements"></a>Requirements

Node version 18.13.0 or above.

### <a id="backend-running"></a>Running

If you have never run the application before, major changes have been made since you last ran, or your `node_modules` folder has been deleted, you will first need to run the following command to install dependencies:

```shell
npm install
```

To run the functions app directly, ensure you have met the [prerequisites](#backend-prerequisites) and execute:

```shell
npm start
```

This will serve the functions app on port 7071.

#### <a id="backend-prerequisites"></a>Prerequisites

You will need to have a file named `.env` placed in the `api/node` directory. The contents of that file must be:

```
MSSQL_HOST={the TLD of the database}
MSSQL_DATABASE={the name of the database}
MSSQL_USER={the SQL Server Admin username}
MSSQL_PASS={the SQL Server Admin user password}
MSSQL_ENCRYPT="true"
MSSQL_TRUST_UNSIGNED_CERT="true"
AZURE_MANAGED_IDENTITY=
```

> NOTE:
> - Replace the curly braces and their contents with the appropriate string.
> - If you do not have access to the admin password, ask an `owner` of the SQL Server resource in Azure for the value

You will need to have the [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Cmacos%2Ccsharp%2Cportal%2Cbash#install-the-azure-functions-core-tools) installed.

You will need to have a file named local.settings.json placed in the `functions/node` directory. The contents of that file must be:

```
{
    "Host": {
        "CORS": "*"
    }
}
```

# Contributing

## Style and Secrets Enforcement

[pre-commit](https://pre-commit.com) allows us to make use of hooks that enforce style and prevent secrets from being committed to the repo. As such, it is expected that all code pushed to the repository have had these pre-commit hooks executed on all files created or updated. The configuration can be seen in `.pre-commit-config.yaml`.

`pre-commit` must be installed locally on your development machine to enable the hooks to be run. Please follow the [install instructions](https://pre-commit.com/index.html#installation), taking care to follow the step which configures a git hook script and allow these hooks to run on all commits. To double-check that you are ready to use pre-commit, ensure that you have a file named `pre-commit` in the `.git/hooks` directory.

[`pre-commit.ci`](https://pre-commit.ci/) is provided free for open-source repositories ([see here](https://pre-commit.ci/#pricing)) and allows us to leverage `pre-commit` in our continuous integration (CI) process. Configuration is handled in `.pre-commit-config.yaml`.

### Possible Issue with pre-commit

When you install `pre-commit`, your package manager may install an older version such as `1.1.0`. There is a [known issue](https://github.com/Yelp/detect-secrets/issues/452) with that specific version and newer versions of Python. If in the execution of your pre-commit hooks you encounter an error like the following, you may need to update your version of `pre-commit`.

> [scan]  ERROR   No plugins to scan with!

## Accessibility

We run `pa11y` to validate accessibility compliance with Web Content Accessibility Guidelines 2.1 AA standards. This is automated as part of our CI/CD pipeline, but running locally when UI changes are being made is advisable. To do this you can follow these steps:

1. Ensure the url for the pages you are working on are listed in `/gui/.pa11yci`
1. Ensure any mock data necessary for the pages you are working on are handled in the mock api
1. Execute `npm run start:pa11y`
1. In a separate shell, execute `npm run pa11y:ci`
   1. Ensure that the output does not reflect any errors
