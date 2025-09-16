# Storage Queue

## Context

The architecture needs a message queue to support long-running jobs related to data migration from source systems.

## Decision

Storage Queues are approved for use over other message queue solutions because storage queues
are readily available when using Azure Function queue triggers and are suitable for existing needs.

## Status

Accepted

## Consequences

The architecture uses existing provisioned infrastructure without the need to add additional dependencies.
