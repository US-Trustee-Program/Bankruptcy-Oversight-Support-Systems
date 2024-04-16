# Github Action (GHA) Reusable Workflows

## Context

The main GHA workflow file (continuous-deployment.yml) has grown in size and complexity. To improve readability and maintainability, job steps will be group into reusable workflows. In order to use GHA reusable workflow yaml **MUST** reside directly under the folder path, ``.github/workflows``, therefore subfolders cannot be used to organize files in this path.

## Decision

To alleviate confusion and improve on organizing GHA reusable workflow under the ``.github/workflows``, it was decided to add a prefix to the filename to provide context of a yaml file's purpose.

- ***sub-***
  - Represent a grouping of related jobs. Defines a collection of jobs, steps, and call on other reusable workflow.
- ***reusable-***
  - Represent an atomic piece of work executed in a Continuous Integration Continous Delivery (CICD) pipeline. It can be a collection of jobs and steps.

All other yaml files represent a non-reusable workflow that represent a entry point for a workflow run that is triggered through automation (pull request event) and/or a manual process by a user.

## Status

## Consequences

- There are known GHA reusable workflow limitations. See documents [here](https://docs.github.com/en/actions/using-workflows/reusing-workflows#limitations).
