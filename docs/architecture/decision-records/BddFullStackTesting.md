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
- **Integration tests with SuperTest**: Don't test the React layer
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

**Implementation**:
```typescript
vi.mock('mongodb', () => {
  class MockCursor {
    async toArray() { return []; }
    async *[Symbol.asyncIterator]() { /* async iteration support */ }
  }
  class MockMongoClient {
    async connect() { return this; }
    db() { return { collection() { return { find() { return new MockCursor(); } }; } }; }
  }
  return { MongoClient: MockMongoClient, Db: MockDb };
});
```

**Critical Details**:
- MongoDB cursors must implement `Symbol.asyncIterator` for compatibility
- MSSQL mocks must include type functions (VarChar, Int, Bit, etc.)
- Mocks return valid structures but no data (data comes from spies)
- **IMPORTANT**: Use plain async functions, not `vi.fn().mockResolvedValue()` for collection methods. Using `vi.fn()` creates new instances each time, making methods non-callable. All MongoDB collection methods (`find`, `findOne`, `insertOne`, `updateOne`, `replaceOne`, `deleteOne`, etc.) must be implemented as plain async functions that return proper MongoDB response objects (e.g., `{ modifiedCount: 1, acknowledged: true }`)

#### 2. Spy on Gateway Methods to Inject Test Data

**Decision**: Use `vi.spyOn()` on production gateway prototype methods after server initialization.

**Rationale**:
- Tests production code paths through all layers
- Injects controlled test data at the system boundary
- Allows verification that gateways are called with correct parameters
- Maintains separation between test setup and production code

**Implementation**:
```typescript
// Set up after server starts
const { CasesDxtrGateway } = await import('.../cases.dxtr.gateway');
vi.spyOn(CasesDxtrGateway.prototype, 'getCaseDetail')
  .mockResolvedValue(testCaseData);

const { CasesMongoRepository } = await import('.../cases.mongo.repository');
vi.spyOn(CasesMongoRepository.prototype, 'getTransfers')
  .mockResolvedValue(testTransfers);
```

**Why Prototype Spying**:
- Factory pattern creates instances dynamically
- Spying on Factory.getCasesRepository() doesn't work due to module-level caching
- Prototype spying intercepts all instances of the class

#### 2.5. Okta Configuration Format

**Decision**: Use pipe-delimited `key=value` pairs for `CAMS_LOGIN_PROVIDER_CONFIG` and `CAMS_USER_GROUP_GATEWAY_CONFIG`.

**Rationale**:
- The `keyValuesToRecord()` utility function expects pipe-delimited format: `key1=value1|key2=value2`
- Using JSON.stringify() results in empty configuration objects
- Issuer must include a path component (e.g., `/oauth2/default`) for audience derivation
- Backend derives audience from issuer path: `http://test/oauth2/default` → `api://default`

**Implementation**:
```typescript
// Frontend configuration (window.CAMS_CONFIGURATION)
CAMS_LOGIN_PROVIDER: 'okta',
CAMS_LOGIN_PROVIDER_CONFIG: 'issuer=http://test/oauth2/default|clientId=test-client-id|redirectUri=http://localhost:4000/login-callback'

// Backend configuration (process.env)
CAMS_LOGIN_PROVIDER: 'okta',
CAMS_LOGIN_PROVIDER_CONFIG: 'issuer=http://test/oauth2/default',
CAMS_USER_GROUP_GATEWAY_CONFIG: 'clientId=test-client-id|keyId=test-key-id|url=http://test|privateKey={"kty":"RSA","n":"test","e":"AQAB"}'
```

**Critical Details**:
- **Format**: Pipe-delimited `key=value` pairs (NOT JSON)
- **Issuer Path**: Must include path component (e.g., `/oauth2/default`) for audience derivation
- **Audience Derivation**: Backend extracts path from issuer to create audience (e.g., `api://default`)
- **Alignment**: Frontend and backend must use the same issuer value
- **Provider**: Both frontend and backend must use `CAMS_LOGIN_PROVIDER='okta'` (not 'mock')

#### 2.75. Fluent Test Setup API

**Decision**: Provide a fluent API (`TestSetup`) to hide boilerplate spy configuration and make tests more declarative and readable.

**Rationale**:
- Reduces duplication across test files (spy setup was copied in every test)
- Makes test intent clear through declarative method chaining
- Encapsulates the complexity of comprehensive gateway spying
- Easier for new contributors to write tests without understanding spy internals
- Enforces consistent patterns across all BDD tests

**Implementation**:
```typescript
it('should display case details', async () => {
  const testCase = MockData.getCaseDetail({
    override: { caseId: '081-23-12345', caseTitle: 'Test Case' }
  });

  await TestSetup
    .forUser(TestSessions.caseAssignmentManager())
    .withCase(testCase)
    .withTransfers([])
    .withConsolidations([])
    .renderAt(`/case-detail/${testCase.caseId}`);

  await waitForAppLoad();
  await expectPageToContain(testCase.caseTitle);
});
```

**API Design**:
- **Fluent/Chainable**: Methods return `this` for method chaining
- **Declarative**: Read like english sentences describing test setup
- **Type-Safe**: TypeScript ensures correct data types
- **Terminal Operation**: `.renderAt(route)` completes setup and renders app

**Available Methods**:
- `.forUser(session)` - Set user session (required, always first)
- `.withCase(case)` / `.withCases([cases])` - Provide case detail(s)
- `.withSearchResults([cases])` - Mock search results
- `.withMyAssignments([cases])` - Mock user's assigned cases
- `.withTransfers([transfers])` - Provide transfer data
- `.withConsolidations([consolidations])` - Provide consolidation data
- `.withCaseAssignments(caseId, [assignments])` - Provide assignments map
- `.withDocketEntries([entries])` - Provide docket entries
- `.withCaseNotes([notes])` - Provide case notes
- `.withOffices([offices])` - Provide office data
- `.renderAt(route)` - Render app at route (terminal operation)

**Helper Functions**:
- `await waitForAppLoad()` - Wait for "Loading session" to complete
- `await expectPageToContain(text)` - Assert text appears on page
- `await expectPageToMatch(pattern)` - Assert regex matches page content

**Benefits**:
1. **Readability**: Test intent is immediately clear
2. **Maintainability**: Changes to spy setup happen in one place
3. **Discoverability**: IDE autocomplete shows available data methods
4. **Consistency**: All tests follow the same pattern
5. **Reduced Boilerplate**: ~30 lines of setup becomes ~5 lines

**Location**: `test/bdd/helpers/fluent-test-setup.ts`

**Documentation**: See `test/bdd/FLUENT_API.md` for complete API reference

#### 3. Run Real HTTP Server (Not SuperTest)

**Decision**: Start an actual Express HTTP server on port 4000, not using SuperTest's request agent.

**Rationale**:
- React components make real `fetch()` calls that require a listening server
- SuperTest's virtual requests don't work with browser-based fetch
- Tests the complete HTTP stack including middleware, routing, error handling
- Matches production behavior more closely

**Implementation**:
```typescript
beforeAll(async () => {
  await initializeTestServer(); // Starts HTTP server on port 4000
});

afterAll(async () => {
  await cleanupTestServer(); // Closes server
});
```

#### 4. Render Complete React Application

**Decision**: Render the full `App.tsx` wrapped in `AuthenticationRoutes`, not individual components.

**Rationale**:
- Tests with all production context providers (GlobalAlert, AppInsights, LaunchDarkly)
- Exercises authentication flow and session management
- Tests routing and navigation
- Catches issues that only appear in the full application context

**Implementation**:
```typescript
render(
  <MemoryRouter initialEntries={['/case-detail/123']}>
    <AuthenticationRoutes>
      <App />
    </AuthenticationRoutes>
  </MemoryRouter>
);
```

**Critical Configuration**:
- `window.CAMS_CONFIGURATION` must be set at module load time (not in beforeAll)
- API client captures baseUrl when imported, so config must exist first
- LocalStorage session must be set before rendering

#### 5. Mock Authentication SDKs and Bypass JWT Verification

**Decision**: Mock `@okta/okta-auth-js` and `@okta/okta-react` to prevent browser redirects, and spy on `OktaGateway.getUser()` to bypass HTTPS requirement.

**Rationale**:
- Okta SDK calls `signInWithRedirect()` which redirects to external OAuth provider
- Browser redirect unmounts React app in tests
- Need to simulate authenticated state without external services
- **CRITICAL**: Okta's JWT verifier (`@okta/jwt-verifier`) requires HTTPS URLs, but tests run with HTTP
- Both frontend and backend must use `CAMS_LOGIN_PROVIDER='okta'` to maintain production code paths

**Implementation**:
```typescript
vi.mock('@okta/okta-auth-js', () => ({
  default: vi.fn().mockImplementation(() => ({
    signInWithRedirect: vi.fn().mockResolvedValue(undefined),
    handleLoginRedirect: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockReturnValue(testToken),
    token: { decode: vi.fn().mockReturnValue(decodedToken) },
  })),
}));
```

**Bypassing JWT Verification**:
To avoid the HTTPS requirement while keeping the 'okta' provider, spy on `OktaGateway.getUser()`:
```typescript
vi.spyOn(OktaGatewayModule.default, 'getUser').mockResolvedValue({
  user: session.user,
  groups: [],
  jwt: {
    claims: {
      sub: session.user.id,
      iss: session.issuer,
      aud: 'api://default',
      exp: session.expires,
      groups: session.user.roles,
    },
  },
});
```

**Gateway Selection Based on Provider**:
The `/me` endpoint uses different gateways depending on `CAMS_LOGIN_PROVIDER`:
- `'okta'` → Spy on `OktaGateway.getUser()` (bypasses JWT verification)
- `'mock'` → Spy on `UserSessionCacheMongoRepository.read()`

This is critical for session validation to work correctly.

### Test File Organization

```
test/bdd/
├── helpers/
│   ├── api-server.ts           # HTTP server lifecycle
│   ├── render-with-context.tsx # React rendering helper (renderApp)
│   ├── repository-spies.ts     # Gateway spy helpers
│   ├── fluent-test-setup.ts    # Fluent API for declarative test setup
│   ├── driver-mocks.ts         # Centralized database driver mocks
│   └── setup-tests.ts          # Global configuration
├── fixtures/
│   └── auth.fixtures.ts        # User sessions (TestSessions)
└── features/
    ├── diagnostics/
    │   └── bdd-environment.spec.tsx            # Environment diagnostic tool
    └── case-management/
        ├── case-detail.spec.tsx  # Case detail (4 tests)
        ├── search-cases.spec.tsx # Search (3 tests)
        └── my-cases.spec.tsx     # My Cases (3 tests)
```

**Test Data**: Use `MockData` from `@common/cams/test-utilities/mock-data` for test data creation

## Status

**Active** - BDD full-stack testing environment fully functional with **10/10 production tests passing**:
- View Case Detail: 4 tests ✅
- Search Cases: 3 tests ✅
- My Cases: 3 tests ✅
- All tests use Fluent API for declarative, readable test setup
- Full-stack coverage from React UI through backend use cases
- Tests execute in ~8-10 seconds

**Fluent API Benefits Realized**:
- Reduced test code by 40-50% compared to manual spy setup
- Improved readability through declarative method chaining
- Consistent patterns across all tests
- Easier onboarding for new contributors

A diagnostic test suite is available at `test/bdd/features/diagnostics/bdd-environment.spec.tsx` to verify the BDD environment setup: `npm run test:bdd -- bdd-environment.spec.tsx`

## Consequences

### Benefits

1. **Comprehensive Coverage**: Tests the complete stack in a single test execution, catching integration issues that unit tests miss.

2. **Fast Execution**: Runs in-memory without external services. Backend tests complete in ~3 seconds.

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
- **Documentation**: Maintain detailed ADR (this document) for future developers

## Implementation Notes

### Setting Up a New BDD Test

1. **Create test file** in `test/bdd/features/[feature-name]/`
2. **Mock drivers** at top of file (hoisted before imports)
3. **Start server** in `beforeAll()` hook
4. **Set up spies** in `beforeEach()` or individual tests
5. **Render React app** or make HTTP requests
6. **Assert on behavior** using screen queries or response data

### Common Patterns

**Full-Stack Test Using Fluent API**:
```typescript
it('should display case details through full stack', async () => {
  // GIVEN: A case exists in the system
  const testCase = MockData.getCaseDetail({
    override: {
      caseId: '081-23-12345',
      caseTitle: 'Test Corporation',
      chapter: '11'
    }
  });

  // WHEN: User navigates to case detail page
  await TestSetup
    .forUser(TestSessions.caseAssignmentManager())
    .withCase(testCase)
    .withTransfers([])
    .withConsolidations([])
    .renderAt(`/case-detail/${testCase.caseId}`);

  await waitForAppLoad();

  // THEN: Case details should be displayed
  await expectPageToContain(testCase.caseTitle);
  await expectPageToContain(testCase.caseId);
});
```

**Key Benefits**:
- Declarative test setup through method chaining
- Clear Given/When/Then structure
- Abstraction hides spy complexity
- Tests read like specifications

### Debugging Tips

1. **Server not starting**: Check that driver mocks are defined before any imports
2. **Spies not working**: Ensure spying happens after server initialization
3. **React not rendering**: Verify `window.CAMS_CONFIGURATION` is set at module level
4. **Authentication failing**: Check provider matches between config and session
5. **API calls failing**: Use browser DevTools Network tab (jsdom supports it)

## Related Documentation

- [Authentication Modes ADR](AuthenticationModes.md) - Authentication provider selection
- [API Technology ADR](ApiTechnology.md) - Express server architecture
- [Frontend Build Tooling ADR](FrontendBuildTooling.md) - React testing configuration
- `test/bdd/README.md` - Getting started guide and overview
- `test/bdd/FLUENT_API.md` - Complete Fluent API reference
- `test/bdd/AI_TESTING_GUIDELINES.md` - Detailed guidelines for writing tests
- `test/bdd/REFACTORING_STATUS.md` - Refactoring history and current status

## References

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [BDD with Cucumber](https://cucumber.io/docs/bdd/) - Inspiration for scenario structure
- [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) - Testing strategy philosophy
