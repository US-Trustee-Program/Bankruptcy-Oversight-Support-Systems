# Cross-Function App Queue Communication

## Context

CAMS uses separate Azure Function Apps for API and Dataflows. Following Azure best practices, each function app uses a dedicated storage account for operational isolation, security, and independent scaling.

When API needs to enqueue work for Dataflows, direct queue writes via Azure Storage Queue output bindings fail because API writes to its own storage account while Dataflows reads from a different storage account.

Using a shared storage account was considered but rejected because it violates Azure best practices, creates operational coupling, and reduces isolation.

## Decision

API will use HTTP requests to enqueue work for Dataflows. The Dataflows function app exposes HTTP endpoints that accept queue write requests and write messages to its own storage queue.

When API needs to queue work, it makes an HTTP POST to the Dataflows endpoint. The Dataflows HTTP trigger validates the request, writes the message to its storage queue, and returns success. The Dataflows queue trigger then processes the message normally.

## Status

Accepted

## Consequences

This approach works in all environments and maintains separate storage accounts per function app. The HTTP pattern provides clear observability and uses API key authentication for security.

The additional HTTP hop adds latency compared to direct queue writes. The approach requires configuration in both function apps (dataflows URL and API key) and adds HTTP endpoint components to maintain. Both function apps must use separate storage accounts in all environments including local development.
