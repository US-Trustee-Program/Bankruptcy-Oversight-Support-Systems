# AI Guidelines for Writing BDD Full-Stack Tests

This guide provides detailed instructions for AI assistants to write effective BDD (Behavior-Driven Development) full-stack tests for the CAMS application.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Essential Setup](#essential-setup)
4. [Mocking and Spying Patterns](#mocking-and-spying-patterns)
5. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
6. [Best Practices](#best-practices)
7. [Test Fixtures and Data](#test-fixtures-and-data)
8. [Known Issues](#known-issues)

---

## Testing Philosophy

### What are BDD Full-Stack Tests?

BDD full-stack tests exercise the **COMPLETE application stack** in a single Node.js process:
- **Frontend**: React components rendered with Testing Library
- **API Client**: Real HTTP calls via `api2.ts`
- **Express Server**: Running in-process on `localhost:4000`
- **Backend Controllers**: Processing requests
- **Use Cases**: Business logic execution
- **Gateways/Repositories**: **Spied production code** with mocked methods

### Key Principle: Spy, Don't Stub

**CRITICAL**: We spy on **production gateway/repository classes** and mock individual methods. We do NOT create stub implementations or fake classes.

```typescript
// ✅ CORRECT - Spy on production class
const { CasesDxtrGateway } = await import(
  '../../../../backend/lib/adapters/gateways/dxtr/cases.dxtr.gateway'
);
vi.spyOn(CasesDxtrGateway.prototype, 'getCaseDetail').mockResolvedValue(testCase);

// ❌ WRONG - Don't create fake classes
class FakeCasesDxtrGateway { ... }
```

---

## Test Structure

### File Naming Convention

```
test/bdd/features/<feature-area>/<feature-name>.spec.tsx
```

**File Naming**: Use short, descriptive names aligned with feature verticals. Avoid redundant suffixes like "-fullstack" or "-test".

Examples:
- `test/bdd/features/case-management/case-detail.spec.tsx`
- `test/bdd/features/case-management/search-cases.spec.tsx`
- `test/bdd/features/case-management/my-cases.spec.tsx`

### Fluent API Test Template

**This is the standard approach for all BDD full-stack tests:**

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
 * BDD Feature: <Feature Name> (Full Stack)
 *
 * As a <user role>
 * I want to <action>
 * So that <benefit>
 */
describe('Feature: <Feature Name> (Full Stack)', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  // Clean up spies after each test to prevent pollution
  afterEach(() => {
    clearAllRepositorySpies();
  });

  /**
   * Scenario: <scenario description>
   *
   * GIVEN <precondition>
   * WHEN <action>
   * THEN <expected outcome>
   */
  it('should <test scenario>', async () => {
    // GIVEN: Test data
    const testData = MockData.getCaseDetail({
      override: { caseId: '081-23-12345', caseTitle: 'Test Case' }
    });

    // WHEN: User performs action
    await TestSetup
      .forUser(TestSessions.caseAssignmentManager())
      .withCase(testData)
      .renderAt(`/case-detail/${testData.caseId}`);

    await waitForAppLoad();

    // THEN: Expected outcome
    await expectPageToContain(testData.caseTitle);
  }, 20000);
});
```

---

## Essential Setup

### 1. Always Import Driver Mocks

```typescript
// At the top of your test file
import '../../helpers/driver-mocks';
```

This provides mock implementations for MongoDB and other database drivers.

### 2. Initialize Test Server

```typescript
beforeAll(async () => {
  await initializeTestServer();
});

afterAll(async () => {
  await cleanupTestServer();
  clearAllRepositorySpies();
});
```

### 3. Set Up Authentication

```typescript
beforeEach(async () => {
  clearAllRepositorySpies();

  // ALWAYS spy on /me endpoint for authentication
  await spyOnMeEndpoint(TestSessions.caseAssignmentManager());

  const session = TestSessions.caseAssignmentManager();

  // ... additional setup
});
```

Available test sessions:
- `TestSessions.caseAssignmentManager()`
- `TestSessions.trialAttorney()`
- `TestSessions.dataVerifier()`

---

## Mocking and Spying Patterns

### The Comprehensive Gateway Spy Pattern

**ALWAYS use `spyOnAllGateways()` in `beforeEach`** to spy on all gateways with sensible defaults:

```typescript
beforeEach(async () => {
  clearAllRepositorySpies();
  await spyOnMeEndpoint(TestSessions.caseAssignmentManager());

  const session = TestSessions.caseAssignmentManager();

  await spyOnAllGateways({
    // Only specify gateways and methods your test uses
    CasesDxtrGateway: {
      // Leave specific methods unmocked - set them in individual tests
    },
    CasesMongoRepository: {
      // Common default mocks
      getTransfers: vi.fn().mockResolvedValue([]),
      getConsolidation: vi.fn().mockResolvedValue([]),
      getCaseHistory: vi.fn().mockResolvedValue([]),
      getConsolidationChildCaseIds: vi.fn().mockResolvedValue([]),
    },
    CaseAssignmentMongoRepository: {
      findAssignmentsByAssignee: vi.fn().mockResolvedValue([]),
      getAssignmentsForCases: vi.fn().mockResolvedValue(new Map()), // MUST be Map, not array
    },
    OfficesDxtrGateway: {
      getOffices: vi.fn().mockResolvedValue([]),
      getOfficeName: vi.fn().mockReturnValue('Test Office Name'), // SYNCHRONOUS - use mockReturnValue
    },
    UserSessionCacheMongoRepository: {
      read: vi.fn().mockResolvedValue(session),
    },
  });
});
```

### Override Spies for Specific Tests

```typescript
it('should display specific case details', async () => {
  const testCase = MockData.getCaseDetail({
    override: {
      caseId: '081-23-12345',
      caseTitle: 'Test Case',
    }
  });

  // Override the spy for this specific test
  const { CasesDxtrGateway } = await import(
    '../../../../backend/lib/adapters/gateways/dxtr/cases.dxtr.gateway'
  );
  vi.spyOn(CasesDxtrGateway.prototype, 'getCaseDetail').mockResolvedValue(testCase);

  // ... rest of test
});
```

### Async vs Sync Mock Methods

**CRITICAL**: Match the mock type to the actual method signature!

```typescript
// ✅ CORRECT - Async method uses mockResolvedValue
CasesDxtrGateway: {
  getCaseDetail: vi.fn().mockResolvedValue(testCase), // Returns Promise<CaseDetail>
}

// ✅ CORRECT - Sync method uses mockReturnValue
OfficesDxtrGateway: {
  getOfficeName: vi.fn().mockReturnValue('Office Name'), // Returns string
}

// ❌ WRONG - Using mockResolvedValue for sync method
OfficesDxtrGateway: {
  getOfficeName: vi.fn().mockResolvedValue('Office Name'), // Creates Promise, not string
}
```

**How to check**: Look at the method signature in the gateway/repository file:
- `async methodName()` or `methodName(): Promise<T>` → use `mockResolvedValue()`
- `methodName(): T` (no async/Promise) → use `mockReturnValue()`

### Return Types Must Match Exactly

```typescript
// ✅ CORRECT - Search methods return pagination structure
CasesMongoRepository: {
  searchCases: vi.fn().mockResolvedValue({
    metadata: { total: cases.length },
    data: cases,
  }),
}

// ❌ WRONG - Missing pagination wrapper
CasesMongoRepository: {
  searchCases: vi.fn().mockResolvedValue(cases), // Backend expects {metadata, data}
}

// ✅ CORRECT - getAssignmentsForCases returns Map
CaseAssignmentMongoRepository: {
  getAssignmentsForCases: vi.fn().mockResolvedValue(new Map()),
}

// ❌ WRONG - Returning array instead of Map
CaseAssignmentMongoRepository: {
  getAssignmentsForCases: vi.fn().mockResolvedValue([]), // Use case expects Map
}
```

---

## Common Pitfalls and Solutions

### 1. "Objects are not valid as a React child"

**Symptom**: React crashes with this error, page shows "Something Went Wrong"

**Cause**: A field that should be a string/number is actually an object or Promise

**Common Culprits**:
- `officeName: {}` - Using `mockResolvedValue()` for sync method `getOfficeName()`
- Missing fields in test fixtures

**Solution**:
```typescript
// Check method signature and use correct mock type
OfficesDxtrGateway: {
  getOfficeName: vi.fn().mockReturnValue('Test Office Name'), // NOT mockResolvedValue
}

// Ensure all required fields are present
const testCase = MockData.getCaseDetail({
  override: {
    caseId: '081-23-12345',
    caseTitle: 'Test Case',
    officeName: 'Manhattan', // Explicitly set string fields
    officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
    // ... all other FlatOfficeDetail fields
  }
});
```

### 2. "Cannot read properties of undefined (reading 'X')"

**Symptom**: Backend throws error accessing property on undefined object

**Cause**: Missing or incorrectly structured mock data

**Solution**: Use MockData helpers with correct `override` syntax:
```typescript
// ✅ CORRECT
const testCase = MockData.getCaseDetail({
  override: {
    caseId: '081-23-12345',
    caseTitle: 'Test Case',
  },
});

// ❌ WRONG - Properties passed directly
const testCase = MockData.getCaseDetail({
  caseId: '081-23-12345',
  caseTitle: 'Test Case',
});
```

### 3. Tests Timeout with "Loading session..."

**Symptom**: Test waits for "Loading session" to disappear but never does

**Cause**: Missing spy on endpoint that Session component calls during `postLoginTasks()`

**Solution**: Always use `spyOnMeEndpoint()` which includes office attorneys:
```typescript
await spyOnMeEndpoint(TestSessions.caseAssignmentManager());
```

### 4. "TestingLibraryElementError: Unable to find element"

**Symptom**: `screen.getByText()` fails to find text that's visibly in the DOM

**Cause**: Text is broken up across multiple DOM elements (e.g., spans, divs)

**Solution**: Use `document.body.textContent` for text assertions:
```typescript
// ✅ CORRECT - Handles text across elements
await waitFor(() => {
  const body = document.body.textContent || '';
  expect(body).toContain(testCase.caseTitle);
  expect(body).toContain(testCase.caseId);
});

// ❌ FRAGILE - May fail if text is split
expect(screen.getByText(testCase.caseTitle)).toBeInTheDocument();
```

### 5. "Unmocked method called" Breadcrumbs

**Symptom**: Test logs show `[BDD TEST] Unmocked OfficesDxtrGateway.getOfficeName() called`

**Meaning**: The comprehensive spy system detected a method call without a mock

**Solution**: Add the method to your `spyOnAllGateways()` config:
```typescript
await spyOnAllGateways({
  OfficesDxtrGateway: {
    getOfficeName: vi.fn().mockReturnValue('Test Office Name'),
  },
});
```

---

## Best Practices

### 1. Use `renderApp()` Not `renderWithContext()`

**ALWAYS render the full application**:
```typescript
// ✅ CORRECT - Renders full app with routing
renderApp({
  initialRoute: '/case-detail/081-23-12345',
  session: TestSessions.caseAssignmentManager(),
});

// ❌ DEPRECATED - Don't render individual components
renderWithContext(<CaseDetailScreen caseId="..." />);
```

### 2. Wait for Loading State to Complete

```typescript
// ALWAYS wait for app to finish loading before assertions
await waitFor(
  () => {
    const body = document.body.textContent || '';
    expect(body).not.toContain('Loading session');
  },
  { timeout: 10000, interval: 500 },
);

console.log('[TEST] ✓ App finished loading');

// Now safe to interact with UI
```

### 3. Use Generous Timeouts for Full-Stack Tests

```typescript
it('should render case details', async () => {
  // Test implementation
}, 20000); // 20 second timeout for full-stack tests

await waitFor(
  () => {
    // Assertions
  },
  { timeout: 10000, interval: 500 }, // 10 second waitFor
);
```

### 4. Test Isolation

Each test should:
- Set up its own test data
- Override specific mocks as needed
- Not depend on other tests' state

```typescript
it('should display Chapter 7 case', async () => {
  // GIVEN: Create test data for this specific test
  const testCase = MockData.getCaseDetail({
    override: {
      caseId: '081-23-11111',
      chapter: '7',
    }
  });

  // Override spy for this test
  const { CasesDxtrGateway } = await import(
    '../../../../backend/lib/adapters/gateways/dxtr/cases.dxtr.gateway'
  );
  vi.spyOn(CasesDxtrGateway.prototype, 'getCaseDetail').mockResolvedValue(testCase);

  // WHEN: Render and interact
  renderApp({ initialRoute: `/case-detail/${testCase.caseId}`, session });

  // THEN: Assert
  await waitFor(() => {
    expect(document.body.textContent).toMatch(/Chapter 7/i);
  });
});
```

### 5. Document BDD Scenarios

Use Given/When/Then comments:
```typescript
/**
 * Scenario: User views case details
 *
 * GIVEN a case exists in the system
 * WHEN the user navigates to the case detail page
 * THEN the basic case information should be displayed
 * AND the case title, debtor name, and filing information should be visible
 */
it('should display case details', async () => {
  // GIVEN: A case exists
  const testCase = MockData.getCaseDetail({ override: { ... } });

  // WHEN: User navigates to page
  renderApp({ initialRoute: `/case-detail/${testCase.caseId}`, session });

  // THEN: Details should display
  await waitFor(() => {
    expect(document.body.textContent).toContain(testCase.caseTitle);
  });
});
```

### 6. Log Progress for Debugging

```typescript
console.log('[TEST] ✓ App finished loading');
console.log('[TEST] ✓ Navigated to search page');
console.log('[TEST] ✓ Search executed');
console.log('[TEST] ✓ Results displayed');
```

---

## Test Fixtures and Data

### Using MockData Helpers

```typescript
import MockData from '@common/cams/test-utilities/mock-data';

// Create case detail
const testCase = MockData.getCaseDetail({
  override: {
    caseId: '081-23-12345',
    caseTitle: 'Test Case',
    chapter: '11',
  },
});

// Create case summary
const summary = MockData.getCaseSummary({
  override: {
    caseId: '081-23-12345',
    caseTitle: 'Test Case',
  },
});

// Create multiple cases
const cases = Array.from({ length: 5 }, (_, i) =>
  MockData.getCaseSummary({
    override: {
      caseId: `081-23-${10000 + i}`,
      caseTitle: `Test Case ${i + 1}`,
    },
  }),
);
```

### Using Test Fixtures

```typescript
import MockData from '@common/cams/test-utilities/mock-data';
import { TestSessions } from '../../fixtures/auth.fixtures';

const testCase = MockData.getCaseDetail({
  override: {
    caseId: '081-23-12345',
    caseTitle: 'Test Case',
    chapter: '11',
  }
});

const session = TestSessions.caseAssignmentManager();
```

### Required Fields for Case Detail

When creating case detail test data, ensure all `FlatOfficeDetail` fields are present:

```typescript
const testCase = MockData.getCaseDetail({
  override: {
    // Case identifiers
    caseId: '081-23-12345',
    caseTitle: 'Test Case',
    chapter: '11',
    dateFiled: '2023-01-15',

  // Office details (all required!)
  officeName: 'Manhattan',
  officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
  courtId: '0801',
  courtName: 'Southern District of New York',
  courtDivisionCode: '081',
  courtDivisionName: 'Manhattan',
  groupDesignator: 'NY',
  regionId: '02',
  regionName: 'NEW YORK',
  state: 'NY',
});
```

---

## Known Issues

### Test Pollution (Near-Term Priority)

**Issue**: Tests pass individually but fail when run together in the same suite.

**Symptoms**:
```bash
# Passes
npm run test:bdd -- case-detail.spec.tsx

# Fails when run with others
npm run test:bdd -- case-detail.spec.tsx search-cases.spec.tsx
```

**Likely Causes**:
- Shared state between tests not being cleaned up
- Server state persisting across test files
- Alert timers or async operations not being cancelled

**Temporary Workaround**: Run test suites individually

**TODO**: Investigate and fix test isolation issues

---

## Quick Reference: Common Spy Configurations

### Case Detail Tests

```typescript
await spyOnAllGateways({
  CasesDxtrGateway: {
    // Mock in individual test: getCaseDetail
  },
  CasesMongoRepository: {
    getTransfers: vi.fn().mockResolvedValue([]),
    getConsolidation: vi.fn().mockResolvedValue([]),
    getCaseHistory: vi.fn().mockResolvedValue([]),
    getConsolidationChildCaseIds: vi.fn().mockResolvedValue([]),
  },
  CaseAssignmentMongoRepository: {
    findAssignmentsByAssignee: vi.fn().mockResolvedValue([]),
    getAssignmentsForCases: vi.fn().mockResolvedValue(new Map()),
  },
  DxtrCaseDocketGateway: {
    getCaseDocket: vi.fn().mockResolvedValue([]),
  },
  CaseNotesMongoRepository: {
    read: vi.fn().mockResolvedValue([]),
    getNotesByCaseId: vi.fn().mockResolvedValue([]),
  },
  OfficesMongoRepository: {
    getOfficeAttorneys: vi.fn().mockResolvedValue([]),
  },
  OfficesDxtrGateway: {
    getOffices: vi.fn().mockResolvedValue([]),
    getOfficeName: vi.fn().mockReturnValue('Test Office Name'),
  },
  UserSessionCacheMongoRepository: {
    read: vi.fn().mockResolvedValue(session),
  },
});
```

### Search Tests

```typescript
await spyOnAllGateways({
  CasesMongoRepository: {
    // Mock in individual test: searchCases
    getConsolidation: vi.fn().mockResolvedValue([]),
    getConsolidationChildCaseIds: vi.fn().mockResolvedValue([]),
  },
  CaseAssignmentMongoRepository: {
    findAssignmentsByAssignee: vi.fn().mockResolvedValue([]),
    getAssignmentsForCases: vi.fn().mockResolvedValue(new Map()),
  },
  OfficesMongoRepository: {
    getOfficeAttorneys: vi.fn().mockResolvedValue([]),
  },
  OfficesDxtrGateway: {
    getOffices: vi.fn().mockResolvedValue([]),
  },
  UserSessionCacheMongoRepository: {
    read: vi.fn().mockResolvedValue(session),
  },
});
```

### My Cases Tests

```typescript
await spyOnAllGateways({
  CaseAssignmentMongoRepository: {
    // Mock in individual test: findAssignmentsByAssignee
    getAssignmentsForCases: vi.fn().mockResolvedValue(new Map()),
  },
  CasesMongoRepository: {
    getConsolidation: vi.fn().mockResolvedValue([]),
    getConsolidationChildCaseIds: vi.fn().mockResolvedValue([]),
  },
  OfficesMongoRepository: {
    getOfficeAttorneys: vi.fn().mockResolvedValue([]),
  },
  OfficesDxtrGateway: {
    getOffices: vi.fn().mockResolvedValue([]),
  },
  UserSessionCacheMongoRepository: {
    read: vi.fn().mockResolvedValue(session),
  },
});
```

---

## Running Tests

```bash
# Run all BDD tests
npm run test:bdd

# Run specific test file
npm run test:bdd -- case-detail.spec.tsx

# Run specific test
npm run test:bdd -- case-detail.spec.tsx -t "should display case details"

# Run with coverage
npm run test:bdd:coverage

# Run specific file with coverage
npm run test:bdd:coverage -- case-detail.spec.tsx
```

---

## Checklist for New BDD Test

Before creating a new BDD full-stack test, verify:

- [ ] Test file named with short, descriptive feature name (e.g., `case-detail.spec.tsx`)
- [ ] Imports `../../helpers/driver-mocks`
- [ ] Uses `initializeTestServer()` / `cleanupTestServer()`
- [ ] Uses Fluent API (`TestSetup`) for test setup
- [ ] Uses `MockData` from `@common/cams/test-utilities/mock-data` for test data
- [ ] Waits for "Loading session" to complete (`waitForAppLoad()`)
- [ ] Uses `document.body.textContent` for text assertions
- [ ] Cleans up spies in `afterEach()` using `clearAllRepositorySpies()`
- [ ] Has generous timeouts (10s waitFor, 20s test)
- [ ] Documents scenario with Given/When/Then
- [ ] Includes console.log breadcrumbs
- [ ] Test passes when run individually

---

## Additional Resources

- **Test Helpers**: `test/bdd/helpers/`
  - `render-with-context.ts` - App rendering utilities
  - `api-server.ts` - Test server setup
  - `repository-spies.ts` - Gateway/repository spy utilities
  - `driver-mocks.ts` - Database driver mocks

- **Test Fixtures**: `test/bdd/fixtures/`
  - `auth.fixtures.ts` - User sessions (TestSessions)

- **Test Data**: Use `MockData` from `@common/cams/test-utilities/mock-data`
  - `MockData.getCaseDetail()` - Create case detail test data
  - `MockData.getCaseSummary()` - Create case summary test data
  - `MockData.getCaseAssignment()` - Create assignment test data

- **Documentation**:
  - `docs/architecture/decision-records/BddFullStackTesting.md` - ADR explaining the approach
  - `test/bdd/README.md` - Overview and getting started guide
  - `test/bdd/FLUENT_API.md` - Complete Fluent API reference
  - `test/bdd/AI_TESTING_GUIDELINES.md` - Detailed guidelines for writing tests
  - `test/bdd/REFACTORING_STATUS.md` - Refactoring history and status

---

## Summary

The key to successful BDD full-stack tests:

1. **Spy on production code**, don't create fakes
2. **Use comprehensive gateway spies** in beforeEach
3. **Match mock types** to method signatures (async vs sync)
4. **Wait for loading states** to complete
5. **Use flexible text assertions** (`textContent`, not `getByText`)
6. **Test in isolation** with proper cleanup
7. **Follow the breadcrumbs** from unmocked method errors

When in doubt, refer to passing tests like `case-detail.spec.tsx`, `search-cases.spec.tsx`, and `my-cases.spec.tsx` as examples.
