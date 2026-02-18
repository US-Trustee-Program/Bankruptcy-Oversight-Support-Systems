# Cross-Function App Queue Communication

## Context

CAMS uses separate Azure Function Apps for API and Dataflows. Following Azure best practices, each function app uses a dedicated storage account for operational isolation, security, and independent scaling.

When API needs to enqueue work for Dataflows, the challenge is writing to Dataflows' storage queues from API's execution context.

Using a shared storage account was considered but rejected because it violates Azure best practices, creates operational coupling, and reduces isolation.

## Decision

API writes messages directly to queues in Dataflows' storage account using cross-storage-account access.

API use cases communicate with Dataflows through a domain gateway abstraction that encapsulates queue infrastructure. This gateway is the single interface for API→Dataflows communication, ensuring consistent patterns and preventing direct coupling to storage queue details.

## Status

Accepted

## Consequences

### Benefits
- Simpler architecture: No HTTP hop, no bridge endpoints to maintain
- Better performance: Direct queue writes, no HTTP latency
- Clearer domain API: Gateway interface expresses business intent
- Standard Azure pattern: Cross-storage-account access via connection strings

### Trade-offs
- API requires a connection string to the Dataflows storage account with write access to its queues
- Configuration complexity: Two storage connections required in API
