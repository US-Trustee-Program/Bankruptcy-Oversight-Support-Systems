# AI Guidelines for Writing BDD Full-Stack Tests

This guide provides detailed instructions for AI assistants to write effective BDD (Behavior-Driven Development) full-stack tests for the CAMS application.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Stateful vs Read-Only Testing](#stateful-vs-read-only-testing)
4. [Essential Setup](#essential-setup)
5. [Mocking and Spying Patterns](#mocking-and-spying-patterns)
6. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
7. [Best Practices](#best-practices)
8. [Test Fixtures and Data](#test-fixtures-and-data)
9. [Known Issues](#known-issues)

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
  test('should <test scenario>', async () => {
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

## Stateful vs Read-Only Testing

### Understanding Test Types

The Fluent API supports two types of tests:

**Read-Only Tests** - Display and navigation scenarios:
- ✅ Viewing case details
- ✅ Search and filter operations
- ✅ List views (my cases, search results)
- ✅ Static page rendering
- ❌ Cannot test write operations

**Stateful Tests** - Interactive workflows with writes:
- ✅ Creating case notes
- ✅ Assigning attorneys
- ✅ Editing data
- ✅ Multi-step user journeys
- ✅ Verifying persistence across navigation

### When to Capture TestState

```typescript
// Read-only test - ignore returned state
await TestSetup
  .forUser(TestSessions.caseAssignmentManager())
  .withCase(testCase)
  .renderAt(`/case-detail/${testCase.caseId}`);

await waitForAppLoad();
await expectPageToContain(testCase.caseTitle);

// Stateful test - capture state for assertions
const state = await TestSetup
  .forUser(TestSessions.trialAttorney())
  .withCase(testCase)
  .withCaseNotes(testCase.caseId, [])  // Explicitly provide caseId
  .renderAt(`/case-detail/${testCase.caseId}`);

// Use state for assertions
state.expectNoteCount(testCase.caseId, 0);
```

### Stateful Test Template

```typescript
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('should add a case note and display it', async () => {
  const user = userEvent.setup();

  // GIVEN: A case with no notes
  const testCase = MockData.getCaseDetail({
    override: {
      caseId: '081-23-12345',
      caseTitle: 'Test Case'
    }
  });

  // Capture state from renderAt()
  const state = await TestSetup
    .forUser(TestSessions.trialAttorney())
    .withCase(testCase)
    .withCaseNotes(testCase.caseId, [])  // Empty initially
    .renderAt(`/case-detail/${testCase.caseId}`);

  await waitForAppLoad();

  // Verify initial state
  state.expectNoteCount(testCase.caseId, 0);

  // WHEN: User adds a note via UI
  await user.click(screen.getByRole('button', { name: /add note/i }));

  const noteContent = 'Important case note';
  await user.type(screen.getByLabelText(/note/i), noteContent);
  await user.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // THEN: State should reflect the new note
  state.expectNoteCount(testCase.caseId, 1);
  state.expectNoteExists(testCase.caseId, noteContent);

  // Verify note details
  const notes = state.getNotes(testCase.caseId);
  expect(notes[0].content).toContain(noteContent);

  // AND: Note should appear in UI
  await waitFor(() => {
    expect(screen.getByText(noteContent)).toBeInTheDocument();
  });
}, 30000);
```

### TestState API Reference

**Data Access Methods:**
- `getCase(caseId)` - Get case detail
- `getNotes(caseId)` - Get case notes
- `getTransfers(caseId)` - Get transfers
- `getConsolidations(caseId)` - Get consolidations
- `getAssignments(caseId)` - Get assignments
- `getDocketEntries(caseId)` - Get docket entries

**Assertion Helpers:**
- `expectCaseExists(caseId)` - Assert case exists
- `expectNoteCount(caseId, count)` - Assert note count
- `expectNoteExists(caseId, content)` - Assert note with content exists
- `expectTransferCount(caseId, count)` - Assert transfer count
- `expectAssignmentExists(caseId, attorneyId)` - Assert assignment exists

**Debugging:**
- `state.dump()` - Print all state to console
- `state.dumpCaseDetail(caseId)` - Print detailed state for a case

### Updated Method Signatures

**IMPORTANT**: Methods that manage case-specific data now require explicit `caseId` parameter:

```typescript
TestSetup
  .forUser(session)
  .withCase(caseDetail)
  .withTransfers(caseId, [transfers])         // ← caseId required
  .withConsolidations(caseId, [consolidations]) // ← caseId required
  .withDocketEntries(caseId, [entries])       // ← caseId required
  .withCaseNotes(caseId, [notes])             // ← caseId required
  .renderAt(route);                           // Returns TestState
```

This ensures proper state tracking even with empty arrays.

### Example: case-notes.spec.tsx

See `test/bdd/features/case-management/case-notes.spec.tsx` for complete examples of stateful testing patterns.

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
test('should display specific case details', async () => {
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

## Extending the Fluent API vs Using Custom Spies

### Philosophy: Prefer Fluent API Extensions

**IMPORTANT**: When you need to mock a common, reusable fixture (like trustee history, case notes, assignments, etc.), **extend the Fluent API** by adding a new method rather than using `.withCustomSpy()`.

**Reserve `.withCustomSpy()` as an escape hatch** for obscure, one-off test scenarios that would never be reused.

### When to Extend the Fluent API

Add a new fluent method when:
- ✅ The data is a common domain concept (trustees, cases, notes, assignments, etc.)
- ✅ Multiple tests will need this data
- ✅ The data is part of the user-facing feature being tested
- ✅ The mock setup is complex enough to warrant a helper

**Examples that deserve fluent methods:**
- `.withTrustee()` - Common domain object
- `.withTrusteeHistory()` - Audit logs for trustees
- `.withCaseNotes()` - Case notes are a key feature
- `.withTransfers()` - Transfer orders are common
- `.withOffices()` - Office data used across many screens

### When to Use `.withCustomSpy()`

Use `.withCustomSpy()` only for:
- ❌ One-off, obscure edge cases specific to a single test
- ❌ Testing error conditions with custom mock implementations
- ❌ Temporary spies during test development (refactor to fluent method before committing)

**Examples appropriate for `.withCustomSpy()`:**
```typescript
// Testing error handling - one-off scenario
await TestSetup.forUser(session)
  .withCustomSpy('TrusteesMongoRepository', {
    read: vi.fn().mockRejectedValue(new Error('Database connection failed')),
  })
  .renderAt('/trustees/123');

// Testing specific edge case - unlikely to be reused
await TestSetup.forUser(session)
  .withCustomSpy('SomeObscureGateway', {
    someRareMethod: vi.fn().mockResolvedValue(edgeCaseData),
  })
  .renderAt('/some-route');
```

### How to Add a Fluent API Method

**Step 1**: Add storage and type imports to `TestSetup` class:
```typescript
// test/bdd/helpers/fluent-test-setup.ts
import type { TrusteeHistory } from '@common/cams/trustees';

export class TestSetup {
  // ... existing fields ...
  private trusteeHistory: Map<string, TrusteeHistory[]> = new Map();
```

**Step 2**: Add the fluent method:
```typescript
  /**
   * Provide audit/change history for a specific trustee.
   * This will mock the TrusteesMongoRepository listTrusteeHistory() method.
   *
   * @param trusteeId The trustee ID to associate history with
   * @param history Array of TrusteeHistory records (defaults to empty array)
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(TestSessions.trusteeAdmin())
   *   .withTrustee(testTrustee)
   *   .withTrusteeHistory(testTrustee.trusteeId, history)
   *   .renderAt(`/trustees/${testTrustee.trusteeId}/audit-history`);
   * ```
   */
  withTrusteeHistory(trusteeId: string, history: TrusteeHistory[] = []): TestSetup {
    this.trusteeHistory.set(trusteeId, history);
    return this;
  }
```

**Step 3**: Add spy configuration in `renderAt()` method's spy config:
```typescript
  async renderAt(route: string): Promise<TestState> {
    // ... existing setup ...

    const spyConfig: Record<string, Record<string, unknown>> = {
      // ... existing configs ...

      TrusteesMongoRepository: {
        read: /* ... existing ... */,
        listTrustees: /* ... existing ... */,
        listTrusteeHistory:
          this.trusteeHistory.size > 0
            ? async (trusteeId: string) => {
                return this.trusteeHistory.get(trusteeId) || [];
              }
            : async () => [],
      },
    };

    // ... rest of renderAt ...
  }
```

**Step 4**: Update tests to use the new method:
```typescript
// Before (using custom spy):
await TestSetup.forUser(TestSessions.trusteeAdmin())
  .withTrustee(testTrustee)
  .withCustomSpy('TrusteesMongoRepository', {
    listTrusteeHistory: vi.fn().mockResolvedValue([]),
  })
  .renderAt(`/trustees/${testTrustee.trusteeId}/audit-history`);

// After (using fluent method):
await TestSetup.forUser(TestSessions.trusteeAdmin())
  .withTrustee(testTrustee)
  .withTrusteeHistory(testTrustee.trusteeId, [])
  .renderAt(`/trustees/${testTrustee.trusteeId}/audit-history`);
```

### Benefits of Fluent API Extensions

1. **Self-documenting**: Method names make test intent clear
2. **Type-safe**: TypeScript catches errors at compile time
3. **Reusable**: One implementation used across all tests
4. **Maintainable**: Changes to mock setup happen in one place
5. **Discoverable**: IDE autocomplete shows available options

### Code Review Guideline

During code review, if you see `.withCustomSpy()` being used for common domain data, suggest:

> "This looks like common test data that multiple tests might need. Could we add a `.withXxx()` method to the Fluent API instead of using `.withCustomSpy()`? That would make it more reusable and self-documenting."

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
test('should render case details', async () => {
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
test('should display Chapter 7 case', async () => {
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
test('should display case details', async () => {
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

**Basic Setup:**
- [ ] Test file named with short, descriptive feature name (e.g., `case-detail.spec.tsx`)
- [ ] Imports `../../helpers/driver-mocks`
- [ ] Uses `initializeTestServer()` / `cleanupTestServer()`
- [ ] Uses Fluent API (`TestSetup`) for test setup
- [ ] Uses Fluent API methods (`.withXxx()`) for common data; reserves `.withCustomSpy()` for one-off edge cases
- [ ] Uses `MockData` from `@common/cams/test-utilities/mock-data` for test data
- [ ] Waits for "Loading session" to complete (`waitForAppLoad()`)
- [ ] Uses `document.body.textContent` for text assertions
- [ ] Cleans up spies in `afterEach()` using `clearAllRepositorySpies()`
- [ ] Has generous timeouts (10s waitFor, 20-30s test)
- [ ] Documents scenario with Given/When/Then
- [ ] Includes console.log breadcrumbs
- [ ] Test passes when run individually

**Stateful Testing (if testing write operations):**
- [ ] Captures `TestState` from `renderAt()`: `const state = await TestSetup...renderAt(...)`
- [ ] Uses explicit `caseId` parameter in `.withCaseNotes(caseId, [])` (and similar methods)
- [ ] Uses `state.expectNoteCount()` / `state.expectNoteExists()` for state assertions
- [ ] Verifies UI reflects state changes with `waitFor()` assertions
- [ ] Example reference: `test/bdd/features/case-management/case-notes.spec.tsx`

---

## Additional Resources

- **Test Helpers**: `test/bdd/helpers/`
  - `fluent-test-setup.ts` - Fluent API for declarative test setup
  - `test-state.ts` - TestState class for stateful testing
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

- **Test Examples**:
  - `test/bdd/features/case-management/case-detail.spec.tsx` - Read-only tests
  - `test/bdd/features/case-management/case-notes.spec.tsx` - Stateful tests with write operations
  - `test/bdd/features/case-management/search-cases.spec.tsx` - Search and filter tests
  - `test/bdd/features/case-management/my-cases.spec.tsx` - List view tests

- **Documentation**:
  - `docs/architecture/decision-records/BddFullStackTesting.md` - ADR explaining the approach, including stateful testing
  - `test/bdd/README.md` - Overview, stateful testing guide, and getting started
  - `test/bdd/FLUENT_API.md` - Complete Fluent API and TestState reference
  - `test/bdd/AI_TESTING_GUIDELINES.md` - Detailed guidelines for writing tests

---

## Summary

The key to successful BDD full-stack tests:

1. **Spy on production code**, don't create fakes
2. **Use Fluent API (`TestSetup`)** for declarative test setup
3. **Extend Fluent API for common data**, reserve `.withCustomSpy()` for one-off edge cases
4. **Choose the right test type**:
   - Read-only tests for display/navigation scenarios
   - Stateful tests for write operations and interactive workflows
5. **Capture TestState** when testing writes: `const state = await TestSetup...renderAt(...)`
6. **Provide explicit caseId** for case-specific methods (`.withCaseNotes(caseId, [])`)
7. **Match mock types** to method signatures (async vs sync)
8. **Wait for loading states** to complete
9. **Use flexible text assertions** (`textContent`, not `getByText`)
10. **Test in isolation** with proper cleanup
11. **Follow the breadcrumbs** from unmocked method errors

**Test Examples:**
- **Read-only**: `case-detail.spec.tsx`, `search-cases.spec.tsx`, `my-cases.spec.tsx`
- **Stateful**: `case-notes.spec.tsx` (write operations, state persistence)
