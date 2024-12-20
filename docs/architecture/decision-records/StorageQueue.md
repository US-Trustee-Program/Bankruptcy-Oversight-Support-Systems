# Storage Queue

## Context

The architecture needs a message queue to support long running jobs related to data migration from source systems.

## Decision

Storage Queues are approved for use over other message queue solutions because storage queues
are readily availble when using Azure Durable Functions and are suitable for existing needs.

## Status

Accepted

## Consequences

The architecture uses existing provisioned infrastruture without the need to add additional dependencies.
