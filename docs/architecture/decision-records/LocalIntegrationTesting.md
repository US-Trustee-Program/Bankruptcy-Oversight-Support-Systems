# Local Integration Testing with OCI Containers

## Context

CAMS has unit tests (Vitest) and full end-to-end browser tests (Playwright/BDD), but no intermediate layer for testing multi-service interactions — such as a queue consumer writing to a SQL database — without standing up the full stack or touching shared lower environments. This gap makes it difficult to validate dataflow handler behavior locally before deploying.

The primary alternatives considered were:

- **Shared lower environment only** — rejected because it requires network access, live credentials, and creates test interference between developers.
- **Mocked services in unit tests** — rejected for this layer because mocks cannot exercise real SQL MERGE semantics, queue poison routing, or Azurite queue behavior.

## Decision

We use OCI containers (via Podman) grouped in a pod to run real service dependencies locally for integration testing below the full e2e threshold. A pod provides shared localhost networking so containers communicate as they would in production, without exposing ports beyond the developer's machine.

The pattern uses Azure SQL Edge (ARM64-compatible SQL Server), MongoDB, and Azurite (Azure Storage emulator) as drop-in local equivalents of ACMS SQL Server, Cosmos DB, and Azure Storage Queue respectively. Test harnesses connect directly to these services using the same drivers as production code, bypassing the repository interface layer to assert on raw database state.

## Status

Accepted

## Consequences

Integration tests can run entirely offline against local containers, with no dependency on shared environments or live credentials. Seed scripts are idempotent — they drop and recreate state on each run — so tests are repeatable and self-contained.

The trade-off is that local containers diverge from production services in subtle ways (SQL Edge vs Azure SQL, Azurite vs Azure Storage). These tests validate logic and integration wiring, not production infrastructure compatibility. Full validation against production-equivalent infrastructure remains the responsibility of the deployment pipeline.

Container startup adds latency compared to unit tests, so this layer is run on demand rather than in CI on every push.
