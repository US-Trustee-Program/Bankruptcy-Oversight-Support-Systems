# BDD Full-Stack Integration Tests

This directory contains Behavior-Driven Development (BDD) style tests that provide full-stack code coverage from the React frontend through to the backend API and business logic layers.

## Purpose

These tests verify that the entire CAMS application works correctly end-to-end by:

1. **Testing User Behavior** - Tests are written from the user's perspective, focusing on what they see and do
2. **Full-Stack Coverage** - Each test exercises the complete stack: React → API → Controllers → Use Cases
3. **Catching Integration Issues** - Validates that all layers work together correctly
4. **Living Documentation** - Tests serve as executable specifications of features

## How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  BDD Test (Vitest + React Testing Library)            │
├─────────────────────────────────────────────────────────┤
│  1. React Components                                    │
│     └─ Rendered in jsdom test environment              │
│                                                         │
│  2. API Calls                                           │
│     └─ Real HTTP requests via fetch                    │
│                                                         │
│  3. Express Server (In-Process)                         │
│     └─ localhost:4000 (shared across tests)            │
│                                                         │
│  4. Controllers                                         │
│     └─ Real controller code                            │
│                                                         │
│  5. Use Cases                                           │
│     └─ Real business logic                             │
│                                                         │
│  6. Gateways/Repositories (SPIED)                       │
│     └─ Production classes with mocked methods          │
│                                                         │
│  7. Database/External APIs (MOCKED)                     │
│     └─ MongoDB, MSSQL, Okta drivers mocked             │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

- **Spy on Production Code** - We use `vi.spyOn()` on real gateway/repository classes, not fake implementations
- **Mock at Boundaries** - Only database drivers and external services are mocked
- **Shared HTTP Server** - All tests share a single Express server (sequential execution)
- **Fluent API** - Tests use a declarative, chainable API for setup

## Code Organization

```
test/bdd/
├── features/                  # BDD test files organized by feature
│   ├── case-management/
│   │   ├── view-case-detail-fullstack.spec.tsx  (4 tests)
│   │   ├── search-cases-fullstack.spec.tsx      (3 tests)
│   │   └── my-cases-fullstack.spec.tsx          (3 tests)
│   └── diagnostics/
│       └── bdd-environment.spec.tsx             (diagnostic tool)
│
├── helpers/                   # Test infrastructure
│   ├── fluent-test-setup.ts  # Fluent API for test setup
│   ├── api-server.ts         # Express server initialization
│   ├── repository-spies.ts   # Spy management utilities (spyOnMeEndpoint, spyOnAllGateways)
│   ├── driver-mocks.ts       # MongoDB/MSSQL driver mocks
│   ├── render-with-context.tsx  # React rendering helper (renderApp)
│   └── setup-tests.ts        # Global test configuration
│
├── fixtures/                  # Test data
│   └── auth.fixtures.ts      # User sessions (TestSessions)
│
├── AI_TESTING_GUIDELINES.md  # Detailed guide for AI assistants
├── FLUENT_API.md             # Complete Fluent API reference
├── REFACTORING_STATUS.md     # Refactoring history and status
└── README.md                 # This file
```

## Running Tests

From the project root:

```bash
# Run all BDD full-stack tests
npm run test:bdd

# Run specific test file
npm run test:bdd -- view-case-detail-fullstack.spec.tsx

# Run specific test by name
npm run test:bdd -- -t "should display case details"

# Run with coverage
npm run test:bdd:coverage

# Run with coverage for specific file
npm run test:bdd:coverage -- view-case-detail-fullstack.spec.tsx

# Run diagnostic tests (troubleshooting only)
npm run test:bdd -- bdd-environment.spec.tsx
```

## Test Types

### Feature Tests (Fluent API)

The primary test suite consists of feature tests that verify user-facing behavior:

- `features/case-management/*-fullstack.spec.tsx` - User behavior tests
- **Approach**: Use the **Fluent API** for declarative, high-level test setup
- **Focus**: What the user sees and does
- **Abstraction**: Infrastructure details hidden behind clean API

**Example:**
```typescript
await TestSetup
  .forUser(TestSessions.caseAssignmentManager())
  .withCase(testCase)
  .renderAt(`/case-detail/${testCase.caseId}`);
```

### Diagnostic Tests (Low-Level)

The diagnostic test suite validates the test infrastructure itself:

- `features/diagnostics/bdd-environment.spec.tsx` - Infrastructure diagnostics
- **Approach**: Use **direct helpers** (`renderApp`, `spyOnMeEndpoint`) - NOT the Fluent API
- **Focus**: Configuration, authentication flow, API connectivity
- **Abstraction**: Low-level access to environment variables, LocalStorage, direct API calls

**Why diagnostic tests don't use the Fluent API:**

1. **Independence** - If the Fluent API is broken, diagnostics should still work to help troubleshoot
2. **Low-level inspection** - Need direct access to:
   - `getAuthIssuer()` and `getLoginConfiguration()` functions
   - `LocalStorage.getSession()` to verify session persistence
   - Direct `fetch()` calls to test `/me` endpoint
   - Environment variables (`process.env.*`)
3. **Diagnostic purpose** - Extensive logging and detailed output for troubleshooting
4. **Appropriate abstraction level** - Using the Fluent API would hide the details needed for diagnosis

**When to run diagnostic tests:**
- Troubleshooting test environment setup issues
- Verifying authentication configuration
- Debugging session persistence problems
- Not part of regular test runs

## Writing a New Test

### 1. Use the Fluent API Template

The fluent API provides a declarative way to set up tests:

```typescript
import { describe, it, beforeAll, afterAll, afterEach } from 'vitest';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSetup, waitForAppLoad, expectPageToContain } from '../../helpers/fluent-test-setup';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import MockData from '@common/cams/test-utilities/mock-data';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: Your Feature Name (Full Stack)
 *
 * As a [user role]
 * I want to [action]
 * So that [benefit]
 */
describe('Feature: Your Feature Name (Full Stack)', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  // Clean up spies after each test
  afterEach(() => {
    clearAllRepositorySpies();
  });

  /**
   * Scenario: [scenario description]
   *
   * GIVEN [precondition]
   * WHEN [action]
   * THEN [expected outcome]
   */
  it('should [behavior description]', async () => {
    // GIVEN: Test data
    const testCase = MockData.getCaseDetail({
      override: {
        caseId: '081-23-12345',
        caseTitle: 'Test Case'
      }
    });

    // WHEN: User performs action
    await TestSetup
      .forUser(TestSessions.caseAssignmentManager())
      .withCase(testCase)
      .renderAt(`/case-detail/${testCase.caseId}`);

    await waitForAppLoad();

    // THEN: Expected outcome
    await expectPageToContain(testCase.caseTitle);
  }, 20000);
});
```

### 2. Available Fluent API Methods

The `TestSetup` class provides these chainable methods:

```typescript
TestSetup
  .forUser(session)                       // Set user session (required, always first)
  .withCase(caseDetail)                  // Provide a single case
  .withCases([case1, case2])             // Provide multiple cases
  .withSearchResults([cases])            // Mock search results
  .withMyAssignments([cases])            // Mock user's assigned cases
  .withTransfers([transfers])            // Provide transfer data
  .withConsolidations([consolidations])  // Provide consolidation data
  .withCaseAssignments(caseId, [assignments])  // Provide assignments
  .withDocketEntries([entries])          // Provide docket entries
  .withCaseNotes([notes])                // Provide case notes
  .withOffices([offices])                // Provide office data
  .renderAt(route);                      // Render app (terminal operation)
```

### 3. Helper Functions

```typescript
// Wait for app to finish loading
await waitForAppLoad();

// Assert text appears on page
await expectPageToContain('Expected Text');

// Assert regex matches page content
await expectPageToMatch(/pattern/i);
```

### 4. Test Sessions

Available user sessions from `TestSessions`:

```typescript
TestSessions.caseAssignmentManager()  // Case assignment manager role
TestSessions.trialAttorney()         // Trial attorney role
TestSessions.dataVerifier()          // Data verifier role
```

## Key Patterns

### Given/When/Then Structure

Always use BDD-style comments to make tests readable:

```typescript
it('should display case details when user navigates to case', async () => {
  // GIVEN: A case exists in the system
  const testCase = MockData.getCaseDetail({ ... });

  // WHEN: User navigates to the case detail page
  await TestSetup
    .forUser(TestSessions.caseAssignmentManager())
    .withCase(testCase)
    .renderAt(`/case-detail/${testCase.caseId}`);

  await waitForAppLoad();

  // THEN: The case details should be displayed
  await expectPageToContain(testCase.caseTitle);
  await expectPageToContain(testCase.caseId);
});
```

### Test Isolation

Each test should:
- Set up its own test data
- Not depend on other tests' state
- Clean up spies after execution (handled by `afterEach`)

### Flexible Assertions

Use `document.body.textContent` for assertions when text may be split across elements:

```typescript
await waitFor(() => {
  const body = document.body.textContent || '';
  expect(body).toContain('Expected Text');
});
```

### Logging

Add console logs to track test progress:

```typescript
console.log('[TEST] ✓ App finished loading');
console.log('[TEST] ✓ Navigated to search page');
console.log('[TEST] ✓ Results displayed');
```

## Configuration

### Test Environment

Environment variables are automatically set in `helpers/setup-tests.ts`:

- `DATABASE_MOCK='true'` - Enable mock repositories
- `CAMS_LOGIN_PROVIDER='mock'` - Mock Okta authentication
- `MONGO_CONNECTION_STRING='mongodb://test-mock'`
- `FEATURE_FLAG_SDK_KEY=''` - Disable feature flags

### Vitest Configuration

See `vitest.config.ts` for:
- Sequential file execution (`fileParallelism: false`)
- Coverage configuration
- Path aliases
- Global test setup

## Coverage

The BDD tests provide coverage for:

- `user-interface/src/**/*.{ts,tsx}` - React components, hooks, utilities
- `backend/lib/**/*.ts` - Controllers, use cases, business logic
- `common/src/**/*.ts` - Shared code

View coverage reports:

```bash
# Generate coverage
npm run test:bdd:coverage

# View HTML report
open test/bdd/coverage/index.html
```

## Troubleshooting

### Tests Timeout

- Ensure `await waitForAppLoad()` is called before assertions
- Check that all required mocks are set up
- Increase test timeout: `it('test', async () => { ... }, 30000)`

### "Unmocked method called" Errors

This means you need functionality not yet in the fluent API. **Extend the API** by adding a new method to `TestSetup` in `helpers/fluent-test-setup.ts`.

See the "Method Not Available" section in **FLUENT_API.md** for guidance on extending the API properly.

### "Objects are not valid as React child" Errors

Ensure all spy methods return the correct type:
- Async methods: Use `mockResolvedValue()`
- Sync methods: Use `mockReturnValue()`

## Additional Resources

- **FLUENT_API.md** - Complete API reference for the fluent test setup interface
- **AI_TESTING_GUIDELINES.md** - Comprehensive guide for AI assistants (also useful for humans!)
- **REFACTORING_STATUS.md** - History of the fluent API refactoring
- **Architecture ADR** - `docs/architecture/decision-records/BddFullStackTesting.md`

## Questions?

For more details or examples:
1. **FLUENT_API.md** - Complete reference for all fluent API methods
2. Check existing tests in `features/case-management/`
3. Review `AI_TESTING_GUIDELINES.md` for detailed patterns
4. Examine the fluent API implementation in `helpers/fluent-test-setup.ts`
