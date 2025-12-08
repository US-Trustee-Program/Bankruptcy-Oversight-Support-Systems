# Fluent API Reference

The `TestSetup` fluent API provides a declarative, chainable interface for setting up BDD full-stack tests. This document describes the current as-built API.

## Overview

The fluent API simplifies test setup by handling all the complexity of:
- User authentication and session management
- Gateway/repository spy configuration
- Mock data injection
- React component rendering with routing

## Basic Usage Pattern

```typescript
await TestSetup
  .forUser(session)           // 1. Always start with user
  .withCase(testCase)         // 2. Chain data setup methods
  .withTransfers([])          // 3. Add more data as needed
  .renderAt('/case-detail/123');  // 4. End with renderAt()
```

## API Methods

### 1. User Session (Required)

#### `forUser(session: CamsSession): TestSetup`

Sets the user session for the test. **This must be called first.**

**Parameters:**
- `session` - User session object from `TestSessions`

**Available Sessions:**
- `TestSessions.caseAssignmentManager()` - Case assignment manager role
- `TestSessions.trialAttorney()` - Trial attorney role
- `TestSessions.dataVerifier()` - Data verifier role

**Example:**
```typescript
await TestSetup
  .forUser(TestSessions.caseAssignmentManager())
  .renderAt('/');
```

---

### 2. Case Data Methods

#### `withCase(caseDetail: CaseDetail): TestSetup`

Provides a single case detail for the test. Mocks `CasesDxtrGateway.getCaseDetail()`.

**Parameters:**
- `caseDetail` - Complete case detail object

**Example:**
```typescript
const testCase = MockData.getCaseDetail({
  override: {
    caseId: '081-23-12345',
    caseTitle: 'Test Corporation',
    chapter: '11'
  }
});

await TestSetup
  .forUser(session)
  .withCase(testCase)
  .renderAt(`/case-detail/${testCase.caseId}`);
```

#### `withCases(cases: CaseDetail[]): TestSetup`

Provides multiple case details. Mocks `CasesDxtrGateway.getCaseDetail()` to look up by ID.

**Parameters:**
- `cases` - Array of case detail objects

**Example:**
```typescript
const cases = [
  MockData.getCaseDetail({ override: { caseId: '081-23-11111' } }),
  MockData.getCaseDetail({ override: { caseId: '081-23-22222' } }),
];

await TestSetup
  .forUser(session)
  .withCases(cases)
  .renderAt('/');
```

---

### 3. Search and List Methods

#### `withSearchResults(results: CaseSummary[]): TestSetup`

Mocks search results for case search functionality. Mocks `CasesMongoRepository.searchCases()`.

**Parameters:**
- `results` - Array of case summary objects

**Returns Mock:**
```typescript
{
  metadata: { total: results.length },
  data: results
}
```

**Example:**
```typescript
const searchResults = Array.from({ length: 5 }, (_, i) =>
  MockData.getCaseSummary({
    override: {
      caseId: `081-23-${10000 + i}`,
      caseTitle: `Case ${i + 1}`,
      chapter: '15'
    }
  })
);

await TestSetup
  .forUser(session)
  .withSearchResults(searchResults)
  .renderAt('/');
```

#### `withMyAssignments(assignments: CaseSummary[]): TestSetup`

Mocks "my cases" assignments for the current user. Mocks `CaseAssignmentMongoRepository.findAssignmentsByAssignee()`.

**Parameters:**
- `assignments` - Array of case summaries assigned to the user

**Example:**
```typescript
const myAssignedCases = [
  MockData.getCaseSummary({ override: { caseId: '081-23-11111' } }),
  MockData.getCaseSummary({ override: { caseId: '081-23-22222' } }),
];

await TestSetup
  .forUser(session)
  .withMyAssignments(myAssignedCases)
  .renderAt('/my-cases');
```

---

### 4. Case Enrichment Methods

#### `withTransfers(transfers: Transfer[]): TestSetup`

Provides transfer data for case enrichment. Mocks `CasesMongoRepository.getTransfers()`.

**Parameters:**
- `transfers` - Array of transfer objects (TransferFrom | TransferTo)

**Example:**
```typescript
const transfers = [
  {
    orderType: 'transfer',
    status: 'approved',
    caseId: '081-23-12345',
    // ... other transfer properties
  }
];

await TestSetup
  .forUser(session)
  .withCase(testCase)
  .withTransfers(transfers)
  .renderAt(`/case-detail/${testCase.caseId}`);
```

#### `withConsolidations(consolidations: Consolidation[]): TestSetup`

Provides consolidation data for case enrichment. Mocks `CasesMongoRepository.getConsolidation()`.

**Parameters:**
- `consolidations` - Array of consolidation objects (ConsolidationFrom | ConsolidationTo)

**Example:**
```typescript
const consolidations = [
  {
    consolidationType: 'administrative',
    caseId: '081-23-12345',
    // ... other consolidation properties
  }
];

await TestSetup
  .forUser(session)
  .withCase(testCase)
  .withConsolidations(consolidations)
  .renderAt(`/case-detail/${testCase.caseId}`);
```

#### `withCaseAssignments(caseId: string, assignments: CaseAssignment[]): TestSetup`

Provides assignments for a specific case. Mocks `CaseAssignmentMongoRepository.getAssignmentsForCases()`.

**Parameters:**
- `caseId` - The case ID
- `assignments` - Array of assignment objects for this case

**Example:**
```typescript
const assignments = [
  {
    id: 'assignment-1',
    caseId: '081-23-12345',
    userId: 'user-123',
    name: 'John Doe',
    role: 'TrialAttorney'
  }
];

await TestSetup
  .forUser(session)
  .withCase(testCase)
  .withCaseAssignments(testCase.caseId, assignments)
  .renderAt(`/case-detail/${testCase.caseId}`);
```

---

### 5. Case Detail Methods

#### `withDocketEntries(entries: any[]): TestSetup`

Provides docket entries for case detail. Mocks `DxtrCaseDocketGateway.getCaseDocket()`.

**Parameters:**
- `entries` - Array of docket entry objects

**Example:**
```typescript
const docketEntries = [
  {
    sequenceNumber: 1,
    documentNumber: 1,
    dateFiled: '2023-01-15',
    summaryText: 'Voluntary Petition'
  }
];

await TestSetup
  .forUser(session)
  .withCase(testCase)
  .withDocketEntries(docketEntries)
  .renderAt(`/case-detail/${testCase.caseId}`);
```

#### `withCaseNotes(notes: any[]): TestSetup`

Provides case notes for case detail. Mocks `CaseNotesMongoRepository.read()` and `getNotesByCaseId()`.

**Parameters:**
- `notes` - Array of case note objects

**Example:**
```typescript
const caseNotes = [
  {
    id: 'note-1',
    caseId: '081-23-12345',
    content: 'Important note about this case',
    createdBy: 'user-123',
    createdAt: '2023-01-15T10:00:00Z'
  }
];

await TestSetup
  .forUser(session)
  .withCase(testCase)
  .withCaseNotes(caseNotes)
  .renderAt(`/case-detail/${testCase.caseId}`);
```

#### `withOffices(offices: any[]): TestSetup`

Provides office data. Mocks `OfficesDxtrGateway.getOffices()`.

**Parameters:**
- `offices` - Array of office objects

**Example:**
```typescript
const offices = [
  {
    officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
    officeName: 'Manhattan',
    state: 'NY'
  }
];

await TestSetup
  .forUser(session)
  .withOffices(offices)
  .renderAt('/');
```

---

### 6. Rendering (Terminal Operation)

#### `renderAt(route: string): Promise<void>`

Renders the application at the specified route. **This is the terminal operation** that:
1. Sets up authentication
2. Configures all gateway/repository spies
3. Renders the React app with routing

**Parameters:**
- `route` - Initial route to render (e.g., '/', '/case-detail/123')

**Example:**
```typescript
await TestSetup
  .forUser(session)
  .withCase(testCase)
  .renderAt(`/case-detail/${testCase.caseId}`);

// App is now rendered and ready for assertions
```

---

## Helper Functions

These helper functions work with the fluent API to make tests more readable:

### `waitForAppLoad(): Promise<void>`

Waits for the app to finish loading by checking that "Loading session" text is no longer present.

**Example:**
```typescript
await TestSetup
  .forUser(session)
  .withCase(testCase)
  .renderAt(`/case-detail/${testCase.caseId}`);

await waitForAppLoad();  // Wait for loading to complete

// Now safe to make assertions
```

### `expectPageToContain(text: string): Promise<void>`

Asserts that the specified text appears anywhere on the page. Uses `document.body.textContent` to handle text split across elements.

**Example:**
```typescript
await waitForAppLoad();
await expectPageToContain('Test Corporation');
await expectPageToContain('081-23-12345');
```

### `expectPageToMatch(pattern: RegExp): Promise<void>`

Asserts that the page content matches the specified regex pattern.

**Example:**
```typescript
await waitForAppLoad();
await expectPageToMatch(/Chapter 11/i);
await expectPageToMatch(/Filed: \d{4}-\d{2}-\d{2}/);
```

---

## Default Mocks

The fluent API automatically sets up these default mocks for all tests:

### Always Mocked

- `CasesMongoRepository.getCaseHistory()` → `[]`
- `CasesMongoRepository.getConsolidationChildCaseIds()` → `[]`
- `CaseAssignmentMongoRepository.getAssignmentsForCases()` → `new Map()`
- `OfficesDxtrGateway.getOfficeName()` → `'Test Office Name'`
- `OfficesDxtrGateway.getOffices()` → `[]`
- `OfficesMongoRepository.getOfficeAttorneys()` → `[]`
- `UserSessionCacheMongoRepository.read()` → User session

### Conditionally Mocked

These are only mocked if you provide data:

- `CasesDxtrGateway.getCaseDetail()` - If `.withCase()` or `.withCases()` called
- `CasesMongoRepository.searchCases()` - If `.withSearchResults()` called
- `CasesMongoRepository.getTransfers()` - Uses data from `.withTransfers()`
- `CasesMongoRepository.getConsolidation()` - Uses data from `.withConsolidations()`
- `CaseAssignmentMongoRepository.findAssignmentsByAssignee()` - If `.withMyAssignments()` called
- `DxtrCaseDocketGateway.getCaseDocket()` - If `.withDocketEntries()` called
- `CaseNotesMongoRepository.read()` / `.getNotesByCaseId()` - If `.withCaseNotes()` called

---

## Complete Example

Here's a complete test using multiple fluent API methods:

```typescript
import { describe, it, beforeAll, afterAll, afterEach } from 'vitest';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSetup, waitForAppLoad, expectPageToContain, expectPageToMatch } from '../../helpers/fluent-test-setup';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import MockData from '@common/cams/test-utilities/mock-data';

import '../../helpers/driver-mocks';

describe('Feature: View Case with Full Details (Full Stack)', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  afterEach(() => {
    clearAllRepositorySpies();
  });

  it('should display complete case details with all related data', async () => {
    // GIVEN: A case with transfers, consolidations, and assignments
    const testCase = MockData.getCaseDetail({
      override: {
        caseId: '081-23-12345',
        caseTitle: 'Test Corporation',
        chapter: '11',
        officeName: 'Manhattan'
      }
    });

    const transfers = [{
      orderType: 'transfer',
      status: 'approved',
      caseId: testCase.caseId,
      fromOffice: 'Manhattan',
      toOffice: 'Brooklyn'
    }];

    const consolidations = [{
      consolidationType: 'administrative',
      caseId: testCase.caseId,
      leadCaseId: '081-23-11111'
    }];

    const assignments = [{
      id: 'assignment-1',
      caseId: testCase.caseId,
      userId: 'user-123',
      name: 'Jane Doe',
      role: 'TrialAttorney'
    }];

    const docketEntries = [{
      sequenceNumber: 1,
      documentNumber: 1,
      dateFiled: '2023-01-15',
      summaryText: 'Voluntary Petition'
    }];

    // WHEN: User navigates to case detail page
    await TestSetup
      .forUser(TestSessions.caseAssignmentManager())
      .withCase(testCase)
      .withTransfers(transfers)
      .withConsolidations(consolidations)
      .withCaseAssignments(testCase.caseId, assignments)
      .withDocketEntries(docketEntries)
      .renderAt(`/case-detail/${testCase.caseId}`);

    await waitForAppLoad();

    // THEN: All case details should be displayed
    await expectPageToContain(testCase.caseTitle);
    await expectPageToContain(testCase.caseId);
    await expectPageToMatch(/Chapter 11/i);
    await expectPageToContain('Jane Doe');
    await expectPageToContain('Voluntary Petition');

    console.log('[TEST] ✓ Complete case details displayed');
  }, 20000);
});
```

---

## Design Philosophy

The fluent API follows these principles:

1. **Declarative over Imperative** - Tests describe what data exists, not how to set it up
2. **Chainable Methods** - All setup methods return `this` for fluent chaining
3. **Sensible Defaults** - Common mocks are set up automatically
4. **Progressive Enhancement** - Start simple, add complexity only when needed
5. **Type Safety** - TypeScript ensures correct usage

---

## Implementation Details

**Location:** `test/bdd/helpers/fluent-test-setup.ts`

The `TestSetup` class:
- Maintains internal state for all test data
- Uses the builder pattern for method chaining
- Calls `spyOnAllGateways()` in `renderAt()` to set up all spies
- Uses `renderApp()` to render the React application with routing

---

## Troubleshooting

### Method Not Available

If you need to mock a gateway method not covered by the fluent API, **extend the API** by adding a new method to `TestSetup` in `helpers/fluent-test-setup.ts`.

**Why extend instead of using escape hatches?**
- Maintains declarative, readable tests
- Reusable across all tests
- Self-documenting through method names
- Preserves the fluent API design philosophy

**Example - Adding a new method:**

```typescript
// In helpers/fluent-test-setup.ts
class TestSetup {
  // ... existing code ...

  withAttorneys(attorneys: Attorney[]): TestSetup {
    this.attorneys = attorneys;
    return this;
  }

  // ... in renderAt(), add to spyConfig:
  AttorneysMongoRepository: {
    getAttorneys: vi.fn().mockResolvedValue(this.attorneys),
  }
}
```

Then use it declaratively:
```typescript
await TestSetup
  .forUser(session)
  .withAttorneys([...])
  .renderAt('/');
```

### Spy Not Working

Ensure you're importing driver mocks:

```typescript
import '../../helpers/driver-mocks';
```

### Empty Results Mock Issues

Empty arrays are properly handled. For example, `.withSearchResults([])` will return:
```typescript
{
  metadata: { total: 0 },
  data: []
}
```

This properly tests the "no results" state without causing API errors.

---

## See Also

- **README.md** - Overview of BDD testing
- **AI_TESTING_GUIDELINES.md** - Comprehensive testing guide
- **Test Examples** - `features/case-management/*-fullstack.spec.tsx`
