# Deployment

## Context

We needed a way to eliminate or at least greatly reduce downtime between deployments. To achieve this we had a couple of options:

- Azure Deployment slots
  - utilizes a hot of build in features for Azure App services
  - prevents the needs to handle traffic through our own means
  - automatically deals with hostname management
- Blue Green deployment with application behind an API gateway (load balancer)
  - can handle traffic routing while not at the mercy of built in Azure rules

## Decision

We will Utilize Azure Deployment slots within our webapp and functionapp to reduce downtime for deployments.

## Status

Accepted

## Consequences
