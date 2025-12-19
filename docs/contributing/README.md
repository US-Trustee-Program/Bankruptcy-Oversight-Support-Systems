# Contributing

## Style and Secrets Enforcement

[pre-commit](https://pre-commit.com) allows us to make use of hooks that enforce style and prevent secrets from being committed to the repo. As such, it is expected that all code pushed to the repository have had these pre-commit hooks executed on all files created or updated. The configuration can be seen in `.pre-commit-config.yaml`.

`pre-commit` must be installed locally on your development machine to enable the hooks to be run. Please follow the [install instructions](https://pre-commit.com/index.html#installation).

?> Please see the [Git Hooks](#git-hooks) section to see instructions for configuring this for automated use.

[`pre-commit.ci`](https://pre-commit.ci/) is provided free for open-source repositories ([see here](https://pre-commit.ci/#pricing)) and allows us to leverage `pre-commit` in our continuous integration (CI) process. Configuration is handled in `.pre-commit-config.yaml`.

### Possible Issue with pre-commit

When you install `pre-commit`, your package manager may install an older version such as `1.1.0`. There is a [known issue](https://github.com/Yelp/detect-secrets/issues/452) with that specific version and newer versions of Python. If in the execution of your pre-commit hooks you encounter an error like the following, you may need to update your version of `pre-commit`.

> [scan] ERROR No plugins to scan with!

### Branch Naming

For branches related to Jira tickets, the branch name should begin with `CAMS-` followed by the ticket number.

### Git Hooks

We have created a script to set up git hooks to handle the following:

1. verify that a branch name is appropriate
1. use a common git commit template

The script is located at `ops/git-setup/set-up-git-hooks.sh`.

!> Please run this script by executing `sh ops/git-setup/set-up-git-hooks.sh` from the top directory of the repository.

## Accessibility

We use Playwright with @axe-core/playwright to validate accessibility compliance with Web Content Accessibility Guidelines 2.1 AA standards. This is automated as part of our CI/CD pipeline, but running locally when UI changes are being made is advisable. To do this you can follow these steps:

1. Build the user interface with the fake API and login provider disabled:
   ```sh
   cd user-interface
   CAMS_USE_FAKE_API=true CAMS_LOGIN_PROVIDER=none npm run build
   ```
1. Start the preview server:
   ```sh
   npm run serve
   ```
1. In a separate shell, run the accessibility tests:
   ```sh
   npm run test:a11y
   ```
1. Ensure that the output does not reflect any errors

Alternatively, you can run the tests in interactive UI mode:
```sh
npm run test:a11y:ui
```

## Node Version

[Node Version Manager](https://github.com/nvm-sh/nvm) supports consistent use of a specific version of Node across environments.

### Install `nvm`

See: https://github.com/nvm-sh/nvm#install--update-script

### `.nvmrc`

The Node versions used by the project are specified in `.nvmrc` resource files. These resource files are found adjacent to `package.json` files
in Node app root directories.

### Installing a Node version

Use `nvm` to install a Node version.

```sh
nvm install <node version string>

# For example:
nvm install v18.17
```

### Use a specified Node version

Use `nvm` to switch to the Node version in use. Run the following shell command to manually switch Node versions
when changing into a Node app directory. The `nvm` utility uses the `.nvmrc` file to determine which Node version to use.

```sh
nvm use
```

Alternatively a version can be specified. Note the version must have been previously installed using `nvm install`. This can be
used to override the version specified in the `.nvmrc` file.

```sh
nvm use <node version string>

# For example:
nvm use v18.17
```

### Automatically use a specified Node version

The `nvm use` command can be automatically called when changing into the root directory of a Node app.

See: https://github.com/nvm-sh/nvm#deeper-shell-integration

### Updating the Node version

Update the `.nvmrc` file when the version of Node in use for a given Node app is changed.

```sh
node -v > .nvmrc
```

## Azure CLI

To accomplish many operations-related tasks from your local machine, and to gain access to some resources while running the backend, you will need to install the Azure CLI. Follow the process you prefer for your operating system as outlined in [their documentation](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).

To ensure that you can connect using the Azure Gov tenant, you will need to run the following command:

```shell
az cloud set --name AzureUSGovernment
```

After that is complete, running `az login` will open a browser tab to log you in to your Azure account.

## Architecture Diagrams

We use the Structurizr domain-specific-language (DSL) to describe non-sensitive portions of our system architecture. When the architecture changes, the `/architecture/cams.dsl` file must be updated to reflect that change, and the `/architecture/export-architecture-diagrams.sh` script must be run. The script contains information about proper usage.
