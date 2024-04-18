# Github Action (GHA) Reusable Workflows

## Context

The main GHA workflow file `continuous-deployment.yml` has grown in size and complexity. To improve readability and maintainability, job steps will be grouped into reusable workflows. In order to use GHA reusable workflow yaml **must** reside directly under the folder path `.github/workflows`. Therefore, subfolders cannot be used to organize files in this path.

## Decision

To alleviate confusion and improve on organizing GHA reusable workflow under the `.github/workflows`, it was decided to add a prefix to the filename to provide context of a `yaml` file's purpose.

### sub-

- Represents a grouping of related jobs. Defines a collection of jobs, steps, and calls to other reusable workflow(s).

### reusable-

- Represents an atomic piece of work executed in a Continuous Integration Continuous Delivery (CI/CD) pipeline that could be utilized more than once. It can be a collection of jobs and steps.

All other `yaml` files represent a non-reusable workflow that represent an entry point for a workflow run that is triggered through automation (pull request event) and/or a manual process by a user.

## Status

Approved

## Consequences

- There are [known GHA reusable workflow limitations](https://docs.github.com/en/actions/using-workflows/reusing-workflows#limitations).
