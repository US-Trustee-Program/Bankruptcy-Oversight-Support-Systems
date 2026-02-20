# Cross-Function App Queue Communication

## Context

CAMS uses separate Azure Function Apps for API and Dataflows. Following Azure best practices, each function app uses a dedicated storage account for operational isolation, security, and independent scaling.

When API needs to enqueue work for Dataflows, the challenge is writing to Dataflows' storage queues from API's execution context.

Alternative approaches considered:
- **Shared storage account**: Rejected for the simplicity of direct queue writes. No compelling need to provision a third storage account.
- **HTTP bridge with third storage account**: Considered and initially implemented, but rejected for the simplicity of direct queue writes. A bridge adds unnecessary complexity between API and Dataflows at this time..

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
