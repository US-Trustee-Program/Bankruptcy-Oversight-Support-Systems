# Dataflows

## Context

The use of Durable Functions for long-running jobs was not meeting performance expectations. Specifically, most of the compute time was spent on orchestration, moving tasks in and out of memory, but performing very few migrations.

## Decision

Azure Durable Functions are replaced by queues and queue triggers.

## Status

Supersedes [DurableFunction](/architecture/decision-records/DurableFunction.md)

## Consequences

The architecture remains with the familiar paradigm but performs much better with messages on queues and queue triggers.
