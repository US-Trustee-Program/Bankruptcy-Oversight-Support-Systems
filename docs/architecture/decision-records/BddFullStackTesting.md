# BDD Full-Stack Testing Architecture

## Context

As the CAMS application grew in complexity, we needed a testing strategy that could:

1. Test the complete request-response cycle from React UI through the API layer to the backend use cases and gateways
1. Verify behavior rather than implementation using Behavior-Driven Development (BDD) scenarios
1. Test production code paths without relying on Mock* implementations
1. Run in-memory without requiring external services (databases, OAuth providers)
1. Execute quickly enough for CI/CD pipelines
1. **Provide comprehensive coverage across the monorepo's workspaces** (common, backend, user-interface) **in a single process**

Traditional testing approaches had limitations:
- **Unit tests**: Too granular, miss integration issues, don't test cross-module interactions
- **E2E tests**: Too slow, require full infrastructure (Azure Functions runtime, databases, OAuth), brittle
- **API-only integration tests**: Don't test the React layer
- **Component tests with mock providers**: Don't test real HTTP or backend logic

### Monorepo Testing Challenge

CAMS is structured as an npm workspace monorepo with multiple interdependent packages:
- **common**: Shared types, business logic, and utilities
- **backend**: Use cases, gateways, repositories, and controllers
- **user-interface**: React application
- **test/bdd**: Full-stack behavior tests
- **test/e2e**: End-to-end tests against deployed environments

Code flows across these workspace boundaries during every request. Traditional unit tests can't verify these cross-module interactions without mocking, and running multiple processes (e.g., Azure Functions runtime + separate UI server) adds complexity and slows feedback loops.

We needed a middle ground that exercises the full stack while remaining fast and reliable, with the explicit goal of **achieving maximum test coverage of the most important source code with as few tests as possible**.

## Decision

We implemented a **full-stack BDD testing architecture** that runs the complete application (React UI + Express API + Backend logic) in a single Node.js process with strategic mocking at the system boundaries.

### Testing Strategy Philosophy

**Goal**: Achieve maximum test coverage of critical business logic and integration points with minimal test count.

**Scope**:
- BDD tests cover the "happy path" and common error scenarios for key user workflows
- Tests exercise real production code paths across all workspace modules (common → backend → user-interface)
- Each test covers multiple layers simultaneously (UI, API, use cases, gateways)
- Strategic mocking only at system boundaries (database drivers, external services)

**Relationship to Other Test Types**:
- **BDD tests (this architecture)**: Comprehensive behavior-driven tests covering full-stack integration. Primary test suite for feature validation.
- **Conventional unit tests**: Complement BDD tests for obscure edge cases, complex algorithms, or boundary conditions that are difficult to trigger through the UI. Unit tests remain valuable for testing specific functions in isolation when behavior testing alone would be impractical.
- **E2E tests**: Validate the complete production architecture including Azure Functions runtime, deployed infrastructure, and external service integrations. E2E tests are slower and run against deployed environments, while BDD tests provide faster feedback during development.

**Key Principle**: Prioritize BDD tests that exercise real code across module boundaries. Add targeted unit tests only when edge cases can't be efficiently covered through behavior tests.

### Express vs Azure Functions in Tests

**Production Architecture**: CAMS runs on Azure Functions in deployed environments (development, staging, production).

**Test Architecture**: BDD tests use the Express server (`backend/express/server.ts`) instead of running Azure Functions locally.

**Rationale**:
- **Single-process requirement**: Azure Functions runtime runs in a separate process, breaking the single-process architecture needed for comprehensive monorepo testing
- **Shared business logic**: Both Express and Azure Functions delegate to the same controllers, use cases, and gateways in the backend workspace
- **Identical behavior**: Express routes mirror Azure Function endpoints exactly, testing the same production code paths
- **Faster execution**: Express starts instantly in-process; Azure Functions runtime has longer startup time
- **Simpler debugging**: Single-process execution enables standard debugging tools (breakpoints, stack traces)

**What Gets Tested**: BDD tests verify:
- ✅ Controllers, use cases, gateways, repositories (shared with Azure Functions)
- ✅ Request/response serialization and HTTP status codes
- ✅ Authentication and authorization logic
- ✅ Cross-module data flow (common ↔ backend ↔ user-interface)

**What Gets Deferred to E2E Tests**:
- ❌ Azure Functions runtime-specific behavior (cold starts, function bindings)
- ❌ Azure infrastructure (App Service, Key Vault, Application Insights)
- ❌ Real database connections and query execution
- ❌ External service integrations (Okta OAuth, DXTR system)
- ❌ Production networking, TLS, and connection pooling

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Single Node.js Test Process (Vitest + jsdom)               │
│  Tests code across all monorepo workspaces simultaneously   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  user-interface workspace (Real)                       │ │
│  │  ─────────────────────────────                         │ │
│  │  React Application                                     │ │
│  │  - Full App.tsx with AuthenticationRoutes              │ │
│  │  - All context providers (GlobalAlert, AppInsights)    │ │
│  │  - React Router with MemoryRouter                      │ │
│  │  - Real fetch() calls to localhost:4000                │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │ HTTP (in-process)                  │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  backend workspace (Real - Express, not Azure Funcs)   │ │
│  │  ──────────────────────────────────────────────────    │ │
│  │  Express API Server                                    │ │
│  │  - Real HTTP server on port 4000                       │ │
│  │  - Production controllers & middleware                 │ │
│  │  - JWT authentication verification                     │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  backend workspace (Real)                              │ │
│  │  ──────────────────────────────────────────────────    │ │
│  │  Use Cases & Business Logic                            │ │
│  │  - Production use case implementations                 │ │
│  │  - Validation & business rules from common workspace   │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  backend workspace (Spied)                             │ │
│  │  ──────────────────────────────────────────────────    │ │
│  │  Gateways & Repositories                               │ │
│  │  - Production gateway classes                          │ │
│  │  - vi.spyOn() to inject test data                      │ │
│  │  - CasesDxtrGateway.getCaseDetail()                    │ │
│  │  - CasesMongoRepository.getTransfers()                 │ │
│  │  - OktaGateway.getUser()                               │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  Database Drivers (Mocked)                ← MOCK EDGE  │ │
│  │  - vi.mock('mongodb') - Connection level              │ │
│  │  - vi.mock('mssql') - Connection level                │ │
│  │  - Prevents real database connections                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  External Services (Mocked)              ← MOCK EDGE   │ │
│  │  - vi.mock('@okta/okta-auth-js')                       │ │
│  │  - vi.mock('@okta/okta-react')                         │ │
│  │  - Prevents OAuth redirects                            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

**Key Insight**: This single-process architecture enables testing code from
multiple workspace packages (common, backend, user-interface) simultaneously,
catching cross-module integration bugs that unit tests would miss.
```

### Key Architectural Decisions

#### Mock Database Drivers at Connection Level

**Decision**: Use `vi.mock('mongodb')` and `vi.mock('mssql')` to mock the driver modules before server initialization.

**Rationale**:
- Prevents real database connections while testing production code paths
- Mocks are hoisted by Vitest, running before any imports
- Allows server initialization to succeed without DATABASE_MOCK flag
- Tests the actual gateway implementations, not Mock* classes

**Key Implementation Points**:
- MongoDB cursors must implement `Symbol.asyncIterator` for compatibility
- MSSQL mocks must include type functions (VarChar, Int, Bit, etc.)
- Mocks return valid structures but no data (data comes from spies)
- Use plain async functions for collection methods, not `vi.fn().mockResolvedValue()`

See `test/bdd/helpers/driver-mocks.ts` for the complete driver mock implementations.

#### Spy on Gateway Methods to Inject Test Data

**Decision**: Use `vi.spyOn()` on production gateway prototype methods after server initialization.

**Rationale**:
- Tests production code paths through all layers
- Injects controlled test data at the system boundary
- Allows verification that gateways are called with correct parameters
- Maintains separation between test setup and production code
- Prototype spying required due to factory pattern creating instances dynamically

See `test/bdd/helpers/repository-spies.ts` for spy implementation patterns.

#### Okta Configuration Format

**Decision**: Use pipe-delimited `key=value` pairs for `CAMS_LOGIN_PROVIDER_CONFIG` and `CAMS_USER_GROUP_GATEWAY_CONFIG`.

**Rationale**:
- The `keyValuesToRecord()` utility function expects pipe-delimited format, not JSON
- Issuer must include a path component (e.g., `/oauth2/default`) for audience derivation
- Both frontend and backend must use `CAMS_LOGIN_PROVIDER='okta'` to test production code paths

See `test/bdd/helpers/setup-tests.ts` for the complete configuration implementation.

#### Fluent Test Setup API

**Decision**: Provide a fluent API (`TestSetup`) to hide boilerplate spy configuration and make tests more declarative and readable.

**Rationale**:
- Reduces duplication across test files (spy setup was copied in every test)
- Makes test intent clear through declarative method chaining
- Encapsulates the complexity of comprehensive gateway spying
- Easier for new contributors to write tests without understanding spy internals
- Enforces consistent patterns across all BDD tests

**Benefits**:
- Reduces boilerplate code significantly
- Improves test readability through declarative API
- Centralizes spy management for easier maintenance
- Provides IDE autocomplete for test data methods

See `test/bdd/FLUENT_API.md` for complete API reference and usage examples.

#### Stateful Testing with TestState

**Decision**: Extend the Fluent API to support stateful testing, enabling tests to verify interactive workflows that involve write operations and state changes.

**Rationale**:
- Initial Fluent API only supported read-only tests (displaying pre-configured data)
- Real user workflows involve creating, editing, and deleting data
- Tests need to verify that writes persist and subsequent reads reflect changes
- Traditional approach would require complex spy coordination to track state mutations
- Stateful testing enables complete workflow testing (create → view → edit → delete)

**Key Benefits**:
- Tests real user workflows including write operations
- Verifies state persistence across navigation and component re-renders
- Enables multi-step user journey testing
- Simplifies spy management for interactive scenarios
- Backward compatible - existing read-only tests work unchanged

**Guidance**:
- Use stateful tests for: interactive workflows, write operations, multi-step journeys
- Use read-only tests for: simple display scenarios, search/filter operations, static rendering

See `test/bdd/FLUENT_API.md` for API details and examples.

#### Run Real HTTP Server

**Decision**: Start an actual Express HTTP server on port 4000 in the test process.

**Rationale**:
- React components make real `fetch()` calls that require a listening server
- Tests the complete HTTP stack including middleware, routing, error handling
- Allows testing of real HTTP request/response cycles
- Matches production behavior more closely

See `test/bdd/helpers/api-server.ts` for server lifecycle management (`initializeTestServer()`, `cleanupTestServer()`).

#### Render Complete React Application

**Decision**: Render the full `App.tsx` wrapped in `AuthenticationRoutes`, not individual components.

**Rationale**:
- Tests with all production context providers (GlobalAlert, AppInsights, LaunchDarkly)
- Exercises authentication flow and session management
- Tests routing and navigation
- Catches issues that only appear in the full application context
- Requires careful configuration timing (window.CAMS_CONFIGURATION at module load, LocalStorage before render)

See `test/bdd/helpers/render-with-context.tsx` and `test/bdd/helpers/setup-tests.ts` for rendering and configuration implementation.

#### Mock Authentication SDKs and Bypass JWT Verification

**Decision**: Mock `@okta/okta-auth-js` and `@okta/okta-react` to prevent browser redirects, and spy on `OktaGateway.getUser()` to bypass HTTPS requirement.

**Rationale**:
- Okta SDK calls `signInWithRedirect()` which redirects to external OAuth provider
- Browser redirect unmounts React app in tests
- Need to simulate authenticated state without external services
- **CRITICAL**: Okta's JWT verifier (`@okta/jwt-verifier`) requires HTTPS URLs, but tests run with HTTP
- Both frontend and backend must use `CAMS_LOGIN_PROVIDER='okta'` to maintain production code paths

**Key Points**:
- Spy on `OktaGateway.getUser()` to bypass JWT verification while keeping 'okta' provider
- The `/me` endpoint uses different gateways depending on `CAMS_LOGIN_PROVIDER`:
  - `'okta'` → `OktaGateway.getUser()` (must be spied for tests)
  - `'mock'` → `UserSessionCacheMongoRepository.read()`

See `test/bdd/helpers/repository-spies.ts` (`spyOnMeEndpoint()`) for the complete authentication mock implementation.

### Implementation Details

For details on test file organization, writing tests, and using the Fluent API, see:
- **`test/bdd/README.md`** - Complete guide to BDD testing setup, stateful testing overview, and usage patterns
- **`test/bdd/FLUENT_API.md`** - Fluent API reference with all available methods, TestState API, and examples

## Consequences

### Benefits

1. **Single-Process Monorepo Testing**: Tests code across all workspace packages (common, backend, user-interface) in a single execution, catching cross-module integration issues that unit tests miss.

1. **Maximum Coverage, Minimum Tests**: Each BDD test exercises multiple layers simultaneously (UI → API → use cases → gateways), achieving comprehensive coverage with fewer tests than traditional approaches.

1. **Fast Execution**: Runs in-memory without external services or Azure Functions runtime, providing quick feedback for CI/CD pipelines (typically 10-30 seconds for full suite).

1. **Production Code Paths**: Tests actual gateway implementations, not Mock* classes, increasing confidence in production behavior while avoiding Azure Functions runtime overhead.

1. **BDD Scenarios**: Natural language test descriptions make requirements traceable and tests readable by non-technical stakeholders.

1. **Debuggable**: Single-process execution allows standard debugging tools (breakpoints, console logs, stack traces).

1. **CI/CD Friendly**: No infrastructure dependencies, deterministic results, fast feedback.

1. **Complements Other Test Types**:
   - Conventional unit tests cover edge cases difficult to trigger via UI
   - E2E tests validate Azure Functions runtime and deployed infrastructure
   - BDD tests provide the primary feature validation layer

### Trade-offs

1. **Express vs Azure Functions**: Tests use Express server, not Azure Functions runtime. Azure Functions-specific behavior (cold starts, function bindings, triggers) is not tested. This is **intentional** - E2E tests validate the Azure Functions runtime in deployed environments.

1. **Mock Maintenance**: Database driver mocks must stay compatible with driver interfaces. Breaking changes in MongoDB or MSSQL client libraries require mock updates.

1. **Test Data Management**: Spies must return properly structured data matching production schemas. Incomplete test data causes runtime errors.

1. **Authentication Complexity**: Mocking Okta SDKs requires understanding internal behavior. SDK updates may break mocks.

1. **Module Hoisting**: Vitest hoists `vi.mock()` calls, preventing use of top-level imports in mocks. Requires async imports or inline values.

1. **Boundary Definition**: Choosing where to mock (driver level vs gateway level) affects what gets tested. Too high = less coverage, too low = slower tests.

### Limitations

These limitations are **by design** - they represent concerns that are better tested through other means:

1. **Azure Functions Runtime**: Doesn't test Azure Functions-specific behavior (cold starts, bindings, triggers). **Mitigation**: E2E tests validate Azure Functions in deployed environments.

1. **Database Query Validation**: Mocked drivers don't validate query syntax or structure. Typos in MongoDB aggregations or SQL queries aren't caught. **Mitigation**: Schema validation through TypeScript types, supplemented by E2E tests with real databases.

1. **Network Behavior**: Doesn't test actual HTTP/TLS behavior, connection pooling, timeouts, or retry logic. **Mitigation**: E2E tests exercise production networking.

1. **Authentication Edge Cases**: Simplified OAuth flow doesn't test token expiration, refresh flows, or multi-factor authentication. **Mitigation**: E2E tests validate complete OAuth flow with real Okta.

1. **Performance**: Can't measure real database query performance or identify N+1 query problems. **Mitigation**: Performance testing in staging environments, database query logging.

1. **External Service Contracts**: Mocked external services (DXTR, Okta) may drift from actual API contracts. **Mitigation**: Contract tests and E2E tests validate external integrations.

1. **Edge Case Coverage**: Some obscure edge cases or complex algorithms are difficult to trigger through UI-based behavior tests. **Mitigation**: Complement with conventional unit tests for specific functions when needed.

### Testing Strategy Summary

CAMS uses a layered testing approach where each layer complements the others:

| Test Layer | Purpose | What It Tests | Speed | Infrastructure |
|------------|---------|---------------|-------|----------------|
| **BDD Tests** (this ADR) | Primary feature validation | Full-stack integration across workspaces, production code paths, business logic | Fast (10-30s) | None (in-memory) |
| **Unit Tests** | Edge case coverage | Specific functions, complex algorithms, boundary conditions | Very fast (<1s) | None |
| **E2E Tests** | Production architecture validation | Azure Functions runtime, real databases, external services, deployed infrastructure | Slow (minutes) | Full Azure environment |

**Best Practice**: Start with BDD tests for new features. Add unit tests only for edge cases that can't be efficiently covered through behavior testing. Defer infrastructure and runtime concerns to E2E tests.

## Related Documentation

**Implementation Guides** (test/bdd directory):
- **`test/bdd/README.md`** - Getting started guide, stateful testing overview, test organization, troubleshooting, and FAQ
- **`test/bdd/FLUENT_API.md`** - Complete Fluent API reference, TestState API, and examples
- `test/bdd/AI_TESTING_GUIDELINES.md` - Detailed guidelines for writing tests, including stateful patterns

**Related ADRs**:
- [Authentication Modes ADR](AuthenticationModes.md) - Authentication provider selection
- [API Technology ADR](ApiTechnology.md) - Express server architecture
- [Frontend Build Tooling ADR](FrontendBuildTooling.md) - React testing configuration

## References

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [BDD with Cucumber](https://cucumber.io/docs/bdd/) - Inspiration for scenario structure
- [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) - Testing strategy philosophy
