# Durable Function

## Context

The architecture needs to support long running jobs related to data migration from source systems.

## Decision

Azure Durable Functions is approved for use because the serverless architecture shares much in
common with the existing web API implemented as an Azure Function application.

## Status

Accepted

## Consequences

The architecture uses a familiar programming paradigm across backend implmentations. It also shares
a common CI/CD pipeline with existing web API.
