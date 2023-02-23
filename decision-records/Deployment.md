# Deployment

## Context

USTP environments must be deployed in the Azure Government Cloud. Flexion must maintain similar environments but is free to use commercial Azure products. To the extent possible, Flexion environments must mirror USTP environments.

USTP is restricted to SaaS services that meet FISMA Moderate standards and have been approved for FedRAMP use. Very few CI/CD tools have such approval. Flexion is not restricted in the same way, but to ensure the deployed environments are as similar as possible, we must leverage our IaC in a way that the CI/CD tools used to trigger deployments are an unimportant detail.

## Decision

We will utilize GitHub Actions to deploy to Flexion environments and an Azure Function with webhooks to deploy to USTP environments.

## Status

Proposed

## Consequences
