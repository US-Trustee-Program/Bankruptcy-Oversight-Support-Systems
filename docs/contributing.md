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

We have created a script to run to set up a pre-commit git hook to verify that your branch name is appropriate. It is located at `ops/helper-scripts/set-up-git-hooks.sh`.

!> Please run this script by executing `sh ops/helper-scripts/set-up-git-hooks.sh` from the top directory of the repository.

## Accessibility

We run `pa11y` to validate accessibility compliance with Web Content Accessibility Guidelines 2.1 AA standards. This is automated as part of our CI/CD pipeline, but running locally when UI changes are being made is advisable. To do this you can follow these steps:

1. Ensure the url for the pages you are working on are listed in `/user-interface/.pa11yci`
1. Ensure any mock data necessary for the pages you are working on are handled in the mock API
1. Execute `npm run start:pa11y`
1. In a separate shell, execute `npm run pa11y:ci`
    1. Ensure that the output does not reflect any errors
