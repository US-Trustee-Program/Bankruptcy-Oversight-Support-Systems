# BDD Full-Stack Testing Architecture

## Context

As the CAMS application grew in complexity, we needed a testing strategy that could:

1. **Test the complete request-response cycle** from React UI through the API layer to the backend use cases and gateways
2. **Verify behavior rather than implementation** using Behavior-Driven Development (BDD) scenarios
3. **Test production code paths** without relying on Mock* implementations
4. **Run in-memory** without requiring external services (databases, OAuth providers)
5. **Execute quickly** enough for CI/CD pipelines

Traditional testing approaches had limitations:
- **Unit tests**: Too granular, miss integration issues
- **E2E tests**: Too slow, require full infrastructure, brittle
- **API-only integration tests**: Don't test the React layer
- **Component tests with mock providers**: Don't test real HTTP or backend logic

We needed a middle ground that exercises the full stack while remaining fast and reliable.

## Decision

We implemented a **full-stack BDD testing architecture** that runs the complete application (React UI + Express API + Backend logic) in a single Node.js process with strategic mocking at the system boundaries.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Test Process (Vitest + jsdom)                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  React Application (Real)                              │ │
│  │  - Full App.tsx with AuthenticationRoutes              │ │
│  │  - All context providers (GlobalAlert, AppInsights)    │ │
│  │  - React Router with MemoryRouter                      │ │
│  │  - Real fetch() calls to localhost:4000                │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │ HTTP                               │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  Express API Server (Real)                             │ │
│  │  - Real HTTP server on port 4000                       │ │
│  │  - Production controllers & middleware                 │ │
│  │  - JWT authentication verification                     │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  Use Cases & Business Logic (Real)                     │ │
│  │  - Production use case implementations                 │ │
│  │  - Validation & business rules                         │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  Gateways & Repositories (Spied)                       │ │
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
```

### Key Architectural Decisions

#### 1. Mock Database Drivers at Connection Level

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

#### 2. Spy on Gateway Methods to Inject Test Data

**Decision**: Use `vi.spyOn()` on production gateway prototype methods after server initialization.

**Rationale**:
- Tests production code paths through all layers
- Injects controlled test data at the system boundary
- Allows verification that gateways are called with correct parameters
- Maintains separation between test setup and production code
- Prototype spying required due to factory pattern creating instances dynamically

See `test/bdd/helpers/repository-spies.ts` for spy implementation patterns.

#### 2.5. Okta Configuration Format

**Decision**: Use pipe-delimited `key=value` pairs for `CAMS_LOGIN_PROVIDER_CONFIG` and `CAMS_USER_GROUP_GATEWAY_CONFIG`.

**Rationale**:
- The `keyValuesToRecord()` utility function expects pipe-delimited format, not JSON
- Issuer must include a path component (e.g., `/oauth2/default`) for audience derivation
- Both frontend and backend must use `CAMS_LOGIN_PROVIDER='okta'` to test production code paths

See `test/bdd/helpers/setup-tests.ts` for the complete configuration implementation.

#### 2.75. Fluent Test Setup API

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

#### 2.8. Stateful Testing with TestState

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

#### 3. Run Real HTTP Server

**Decision**: Start an actual Express HTTP server on port 4000 in the test process.

**Rationale**:
- React components make real `fetch()` calls that require a listening server
- Tests the complete HTTP stack including middleware, routing, error handling
- Allows testing of real HTTP request/response cycles
- Matches production behavior more closely

See `test/bdd/helpers/api-server.ts` for server lifecycle management (`initializeTestServer()`, `cleanupTestServer()`).

#### 4. Render Complete React Application

**Decision**: Render the full `App.tsx` wrapped in `AuthenticationRoutes`, not individual components.

**Rationale**:
- Tests with all production context providers (GlobalAlert, AppInsights, LaunchDarkly)
- Exercises authentication flow and session management
- Tests routing and navigation
- Catches issues that only appear in the full application context
- Requires careful configuration timing (window.CAMS_CONFIGURATION at module load, LocalStorage before render)

See `test/bdd/helpers/render-with-context.tsx` and `test/bdd/helpers/setup-tests.ts` for rendering and configuration implementation.

#### 5. Mock Authentication SDKs and Bypass JWT Verification

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

1. **Comprehensive Coverage**: Tests the complete stack in a single test execution, catching integration issues that unit tests miss.

2. **Fast Execution**: Runs in-memory without external services, providing quick feedback for CI/CD pipelines.

3. **Production Code Paths**: Tests actual gateway implementations, not Mock* classes, increasing confidence in production behavior.

4. **BDD Scenarios**: Natural language test descriptions make requirements traceable and tests readable by non-technical stakeholders.

5. **Debuggable**: Single process execution allows standard debugging tools (breakpoints, console logs).

6. **CI/CD Friendly**: No infrastructure dependencies, deterministic results, fast feedback.

### Trade-offs

1. **Mock Maintenance**: Database driver mocks must stay compatible with driver interfaces. Breaking changes in MongoDB or MSSQL client libraries require mock updates.

2. **Test Data Management**: Spies must return properly structured data matching production schemas. Incomplete test data causes runtime errors.

3. **Authentication Complexity**: Mocking Okta SDKs requires understanding internal behavior. SDK updates may break mocks.

4. **Module Hoisting**: Vitest hoists `vi.mock()` calls, preventing use of top-level imports in mocks. Requires async imports or inline values.

5. **Boundary Definition**: Choosing where to mock (driver level vs gateway level) affects what gets tested. Too high = less coverage, too low = slower tests.

### Limitations

1. **Database Query Validation**: Mocked drivers don't validate query syntax or structure. Typos in MongoDB aggregations or SQL queries aren't caught.

2. **Network Behavior**: Doesn't test actual HTTP/TLS behavior, connection pooling, timeouts, or retry logic.

3. **Authentication Edge Cases**: Simplified OAuth flow doesn't test token expiration, refresh flows, or multi-factor authentication.

4. **Performance**: Can't measure real database query performance or identify N+1 query problems.

5. **External Service Contracts**: Mocked external services (DXTR, Okta) may drift from actual API contracts.

### Mitigations

- **Contract Tests**: Add separate contract tests that verify external service integrations
- **E2E Tests**: Complement with full E2E tests in staging environment for critical paths
- **Schema Validation**: Use production TypeScript types to catch data structure mismatches
- **Regular Updates**: Review mocks when upgrading driver libraries
- **Documentation**: Maintain this ADR and `test/bdd/README.md` for implementation guidance

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
