# Bankruptcy Oversight Support Systems (BOSS)

## [United States Trustee Program](https://www.justice.gov/ust)

The United States Trustee Program is the component of the Department of Justice responsible for overseeing the administration of bankruptcy cases and private trustees under 28 U.S.C. § 586 and 11 U.S.C. § 101, et seq. We are a national program with broad administrative, regulatory, and litigation/enforcement authorities whose mission is to promote the integrity and efficiency of the bankruptcy system for the benefit of all stakeholders–debtors, creditors, and the public. The USTP consists of an Executive Office in Washington, DC, and 21 regions with 90 field office locations nationwide.

[Learn More](https://www.justice.gov/ust/about-program)

## Applications

### Frontend

BOSS is a React application which acts as the main place for oversight work to take place.

Note that any commands listed in this section should be run from the `boss` directory.

#### Requirements

Node version 18.13.0 or above.

#### Running

If you have never run the application before, major changes have been made since you last ran, or your `node_modules` folder has been deleted, you will first need to run the following command to install dependencies:

```shell
npm install
```

To run the application directly, execute...

```shell
npm start
```

This will serve the client on port 3000.

# Contributing

## Style and Secrets Enforcement

[pre-commit](https://pre-commit.com) allows us to make use of hooks that enforce style and prevent secrets from being committed to the repo. As such, it is expected that all code pushed to the repository have had these pre-commit hooks executed on all files created or updated. The configuration can be seen in `.pre-commit-config.yaml`.

`pre-commit` must be installed locally on your development machine to enable the hooks to be run. Please follow the [install instructions](https://pre-commit.com/index.html#installation) and allow these hooks to run on all commits.

[`pre-commit.ci`](https://pre-commit.ci/) is provided free for open-source repositories ([see here](https://pre-commit.ci/#pricing)) and allows us to leverage `pre-commit` in our continuous integration (CI) process. Configuration is handled in `.pre-commit-config.yaml`.

### Possible Issue with pre-commit

When you install `pre-commit`, your package manager may install an older version such as `1.1.0`. There is a [known issue](https://github.com/Yelp/detect-secrets/issues/452) with that specific version and newer versions of Python. If in the execution of your pre-commit hooks you encounter an error like the following, you may need to update your version of `pre-commit`.

> [scan]  ERROR   No plugins to scan with!

### Azure Functions

#### Requirements
    JDK Version 17 or above.

    Azure Functions Core Tools version 4

    Installation tool like Homebrew

Azure Functions Core Tools lets you develop and test functions on your local computer from the command prompt or terminal.

Core Tools let functions connect to live Azure Services and even deploy a function app to your Azure Subscription.

1) In your local.settings.json, ensure that the JAVA_HOME parameter points to your JDK \Home\Contents folder.
2) Install Azure Functions Core Tools Package, Version 4, if not already installed.

```shell
brew tap azure/functions
brew install azure-functions-core-tools@4
```
Build and Run the AzureFunction.