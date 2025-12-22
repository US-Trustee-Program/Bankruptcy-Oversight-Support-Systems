# Migration Guide: Unit Tests to BDD Full-Stack Tests

This guide provides step-by-step instructions for AI assistants to migrate existing unit tests to BDD (Behavior-Driven Development) full-stack tests in the CAMS application.

## Table of Contents

1. [Understanding the Migration](#understanding-the-migration)
2. [Why Migrate to BDD Tests](#why-migrate-to-bdd-tests)
3. [Migration Process Overview](#migration-process-overview)
4. [Step 1: Analyze Existing Tests](#step-1-analyze-existing-tests)
5. [Step 2: Map Unit Tests to BDD Scenarios](#step-2-map-unit-tests-to-bdd-scenarios)
6. [Step 3: Capture Baseline Coverage](#step-3-capture-baseline-coverage)
7. [Step 4: Implement BDD Tests](#step-4-implement-bdd-tests)
8. [Step 5: Verify Coverage Equivalence](#step-5-verify-coverage-equivalence)
9. [Step 6: Cleanup and Documentation](#step-6-cleanup-and-documentation)
10. [Examples: Real Migrations](#examples-real-migrations)
11. [Common Patterns](#common-patterns)
12. [Troubleshooting](#troubleshooting)

---

## Understanding the Migration

### What is a Unit Test?

Unit tests test individual components in isolation:

```typescript
// Backend unit test - tests use case in isolation
test('should create a trustee', async () => {
  const trustee = MockData.getTrusteeInput();
  vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(trustee);

  const result = await trusteesUseCase.createTrustee(context, trustee);

  expect(result).toEqual(trustee);
});

// Frontend unit test - tests component in isolation
test('should render trustee name', () => {
  render(<TrusteeDetailScreen trustee={mockTrustee} />);
  expect(screen.getByText('John Doe')).toBeInTheDocument();
});
```

**Characteristics:**
- Tests single layer (component, use case, controller)
- Heavy mocking of dependencies
- Fast execution
- Many small tests

### What is a BDD Full-Stack Test?

BDD tests exercise the **complete application stack** in a single test:

```typescript
test('should display trustee details', async () => {
  // GIVEN: Test data
  const testTrustee = MockData.getTrustee({ override: { name: 'John Doe' } });

  // WHEN: User performs action
  await TestSetup
    .forUser(TestSessions.trusteeAdmin())
    .withTrustee(testTrustee)
    .renderAt('/trustees/123');

  await waitForAppLoad();

  // THEN: Expected outcome
  await expectPageToContain('John Doe');
}, 20000);
```

**Characteristics:**
- Tests entire stack (React → API → Express → Controller → Use Case → Gateway)
- Minimal mocking (only gateways/repositories)
- Behavior-focused scenarios
- Fewer, more comprehensive tests

### Key Differences

| Aspect | Unit Tests | BDD Full-Stack Tests |
|--------|-----------|---------------------|
| **Scope** | Single component/function | Entire user journey |
| **Mocking** | Heavy (all dependencies) | Light (only data layer) |
| **Test Count** | Many (40+ tests) | Few (6-10 scenarios) |
| **Focus** | Implementation details | User behavior |
| **Execution** | Very fast (ms) | Slower (seconds) |
| **Confidence** | Medium (integration gaps) | High (real integration) |
| **Maintenance** | Higher (brittle) | Lower (behavior-stable) |

---

## Why Migrate to BDD Tests?

### Benefits

1. **Higher Confidence**: Tests exercise real integration paths, catching issues unit tests miss
2. **Better Coverage**: One BDD test covers multiple layers (frontend + API + backend)
3. **User-Focused**: Tests reflect actual user behavior, not implementation details
4. **Fewer Tests**: Replace 40+ unit tests with 6-10 BDD scenarios
5. **Easier Maintenance**: Changes to implementation don't break tests (if behavior unchanged)
6. **Better Documentation**: BDD scenarios serve as living documentation

### When to Keep Unit Tests

Not everything should migrate to BDD:
- ✅ **Migrate**: User-facing features, CRUD operations, navigation flows
- ⚠️ **Consider**: Complex business logic (can test both ways)
- ❌ **Keep as Unit Tests**: Pure utility functions, validators, formatters, complex algorithms

---

## Migration Process Overview

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ANALYZE EXISTING TESTS                                   │
│    └─ Find all related unit tests                           │
│    └─ Categorize by feature area                            │
│    └─ Identify coverage targets                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. MAP TO BDD SCENARIOS                                      │
│    └─ Group tests into user journeys                        │
│    └─ Extract test data/fixtures                            │
│    └─ Identify API endpoints involved                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CAPTURE BASELINE COVERAGE                                 │
│    └─ Run unit tests with coverage                          │
│    └─ Save coverage reports                                 │
│    └─ Document key metrics                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. IMPLEMENT BDD TESTS                                       │
│    └─ Create BDD test file                                  │
│    └─ Extend Fluent API if needed                           │
│    └─ Write scenarios                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. VERIFY COVERAGE EQUIVALENCE                               │
│    └─ Run BDD tests with coverage                           │
│    └─ Compare with baseline                                 │
│    └─ Iterate if gaps exist                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. CLEANUP & DOCUMENT                                        │
│    └─ Document migration in test file                       │
│    └─ Remove obsolete unit tests (with approval)            │
│    └─ Update test documentation                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Analyze Existing Tests

### Find All Related Tests

Use search tools to find tests for your feature:

```bash
# Search for test files
find . -name "*.test.ts" -o -name "*.test.tsx" | grep -i "trustee"

# Search for test content
grep -r "describe.*[Tt]rustee" --include="*.test.ts" --include="*.test.tsx"
```

**Using Task Agent:**
```typescript
await Task({
  description: "Find trustee tests",
  prompt: `Find all test files (*.test.ts, *.test.tsx) that test trustee functionality.
  Search in:
  - backend/ directories
  - user-interface/ directories

  For each file, provide:
  - File path
  - Number of test cases
  - Brief summary of what's tested`,
  subagent_type: "Explore"
});
```

### Categorize Tests

Organize tests by layer and feature area:

**Backend Tests:**
```
Use Cases:
  - backend/lib/use-cases/trustees/trustees.test.ts
    ├─ createTrustee (8 tests)
    ├─ listTrustees (2 tests)
    ├─ getTrustee (2 tests)
    └─ updateTrustee (15 tests)

Controllers:
  - backend/lib/controllers/trustees/trustees.controller.test.ts
    ├─ Authorization (6 tests)
    ├─ Feature flags (2 tests)
    ├─ GET endpoints (2 tests)
    ├─ POST endpoints (3 tests)
    └─ PATCH endpoints (5 tests)

Repositories:
  - backend/lib/adapters/gateways/mongo/trustees.mongo.repository.test.ts
    └─ Database operations (12 tests)
```

**Frontend Tests:**
```
Screens:
  - user-interface/src/trustees/TrusteeDetailScreen.test.tsx
    ├─ Loading states (1 test)
    ├─ Rendering (2 tests)
    ├─ Navigation (5 tests)
    └─ Error handling (5 tests)

Components/Panels:
  - user-interface/src/trustees/panels/TrusteeDetailProfile.test.tsx
    ├─ Public contact display (3 tests)
    ├─ Internal contact display (2 tests)
    └─ Edit buttons (2 tests)
```

### Identify Coverage Targets

List the source files that need coverage:

```markdown
**Backend Source Files:**
- backend/lib/use-cases/trustees/trustees.ts
- backend/lib/controllers/trustees/trustees.controller.ts

**Frontend Source Files:**
- user-interface/src/trustees/TrusteeDetailScreen.tsx
- user-interface/src/trustees/TrusteeDetailHeader.tsx
- user-interface/src/trustees/panels/TrusteeDetailProfile.tsx
```

---

## Step 2: Map Unit Tests to BDD Scenarios

### Identify User Journeys

Think about how users interact with the feature, not how the code is structured.

**Example: Trustee Detail View**

**Unit Test Structure (by layer):**
```
Backend:
  ✓ Use case gets trustee from repository
  ✓ Controller calls use case
  ✓ Controller handles errors
Frontend:
  ✓ Screen renders trustee name
  ✓ Screen renders address
  ✓ Screen handles loading
```

**BDD Scenario Structure (by journey):**
```
Scenario 1: View Basic Trustee Information
  GIVEN a trustee exists with basic contact info
  WHEN user navigates to trustee detail page
  THEN name, address, phone, and email are displayed
  (Covers: frontend rendering + backend get endpoint + use case + repository)

Scenario 2: View Trustee with Missing Information
  GIVEN a trustee exists with incomplete contact info
  WHEN user views the trustee
  THEN only available information is shown, missing fields are hidden
  (Covers: frontend conditional rendering + backend handling)

Scenario 3: Access Denied for Non-Admin Users
  GIVEN user does not have TrusteeAdmin role
  WHEN user tries to access trustee page
  THEN access is denied with appropriate message
  (Covers: authorization middleware + controller checks)
```

### Create Mapping Table

Document which unit tests are replaced by each BDD scenario:

```markdown
| BDD Scenario | Unit Tests Replaced | Coverage Notes |
|--------------|-------------------|----------------|
| **Scenario 1: View Basic Trustee** | | |
| | Backend: `trustees.test.ts` - "should return a single trustee" | Use case read path |
| | Backend: `trustees.controller.test.ts` - "should return individual trustee" | Controller GET endpoint |
| | Frontend: `TrusteeDetailScreen.test.tsx` - "should render trustee header" | UI rendering |
| | Frontend: `TrusteeDetailProfile.test.tsx` - "should render public contact" | Contact display |
| **Scenario 2: Missing Information** | | |
| | Frontend: `TrusteeDetailScreen.test.tsx` - "should handle missing contact" | Conditional rendering |
| **Scenario 3: Access Denied** | | |
| | Backend: `trustees.controller.test.ts` - "should deny access without role" | Authorization |
```

### Extract Test Fixtures

Identify test data patterns from unit tests:

```typescript
// From unit tests:
const mockTrustee = {
  trusteeId: '123',
  name: 'John Doe',
  public: {
    address: { address1: '123 Main St', city: 'Anytown', state: 'NY', zipCode: '12345' },
    email: 'john@example.com',
    phone: { number: '555-1234', extension: '100' }
  }
};

// Reuse in BDD tests using MockData:
const testTrustee = MockData.getTrustee({
  override: {
    trusteeId: '123',
    name: 'John Doe',
    public: { /* same structure */ }
  }
});
```

---

## Step 3: Capture Baseline Coverage

### Run Unit Tests with Coverage

**For Backend Tests:**

```bash
# Run specific test files with coverage
npx vitest run --coverage \
  backend/lib/use-cases/trustees/trustees.test.ts \
  backend/lib/controllers/trustees/trustees.controller.test.ts \
  --coverage.reporter=html \
  --coverage.reporter=json-summary

# Save coverage report
mkdir -p coverage-baseline/backend
cp -r coverage coverage-baseline/backend/
cp coverage/coverage-summary.json coverage-baseline/backend/
```

**For Frontend Tests:**

```bash
# Run specific test files with coverage
npx vitest run --coverage \
  user-interface/src/trustees/TrusteeDetailScreen.test.tsx \
  user-interface/src/trustees/panels/TrusteeDetailProfile.test.tsx \
  --coverage.reporter=html \
  --coverage.reporter=json-summary

# Save coverage report
mkdir -p coverage-baseline/frontend
cp -r coverage coverage-baseline/frontend/
cp coverage/coverage-summary.json coverage-baseline/frontend/
```

### Document Baseline Metrics

Create a baseline coverage document:

```markdown
# Baseline Coverage Report
Date: 2025-01-15

## Backend Coverage

### trustees.ts (Use Case)
- Line Coverage: 95.2%
- Branch Coverage: 92.5%
- Function Coverage: 100%
- Uncovered Lines: 145, 203 (error handling edge cases)

### trustees.controller.ts
- Line Coverage: 100%
- Branch Coverage: 100%
- Function Coverage: 100%

## Frontend Coverage

### TrusteeDetailScreen.tsx
- Line Coverage: 92.3%
- Branch Coverage: 88.9%
- Function Coverage: 100%
- Uncovered Lines: 78-82 (loading timeout edge case)

### TrusteeDetailProfile.tsx
- Line Coverage: 100%
- Branch Coverage: 100%
- Function Coverage: 100%

## Total Tests: 45
```

**Extract from JSON:**

```bash
# Extract specific file coverage
cat coverage-baseline/backend/coverage-summary.json | \
  jq '.["backend/lib/use-cases/trustees/trustees.ts"]'
```

---

## Step 4: Implement BDD Tests

### Create BDD Test File

**File Structure:**
```
test/bdd/features/
  ├── case-management/
  │   ├── case-detail.spec.tsx
  │   └── case-notes.spec.tsx
  └── trustee-management/          ← New feature area
      ├── trustee-detail.spec.tsx  ← New file
      └── trustee-list.spec.tsx    ← Future file
```

**Naming Convention:**
- Use feature area as directory: `trustee-management/`, `case-management/`
- Use short, descriptive names: `trustee-detail.spec.tsx` (not `trustee-detail-fullstack-test.spec.tsx`)
- Mirror user-facing feature names

### BDD Test Template

```typescript
import { describe, test, beforeAll, afterAll, afterEach } from 'vitest';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import {
  TestSetup,
  waitForAppLoad,
  expectPageToContain,
  expectPageToMatch,
} from '../../helpers/fluent-test-setup';
import MockData from '@common/cams/test-utilities/mock-data';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * BDD Feature: View Trustee Details (Full Stack)
 *
 * As a USTP Trustee Administrator
 * I want to view detailed information about a trustee
 * So that I can review their contact information and manage their profile
 *
 * This test suite exercises the COMPLETE stack:
 * - React components (TrusteeDetailScreen, TrusteeDetailProfile)
 * - API client (api2.ts)
 * - Express server
 * - Controllers (TrusteesController)
 * - Use cases (TrusteesUseCase)
 * - Mocked repositories (TrusteesMongoRepository)
 *
 * Code Coverage:
 * - user-interface/src/trustees/TrusteeDetailScreen.tsx
 * - user-interface/src/trustees/panels/TrusteeDetailProfile.tsx
 * - backend/lib/controllers/trustees/trustees.controller.ts
 * - backend/lib/use-cases/trustees/trustees.ts
 *
 * Replaces Unit Tests:
 * - user-interface/src/trustees/TrusteeDetailScreen.test.tsx (13 tests)
 * - backend/lib/use-cases/trustees/trustees.test.ts (2 read tests)
 * - backend/lib/controllers/trustees/trustees.controller.test.ts (3 GET tests)
 * Total: 18 unit tests → 6 BDD scenarios
 */
describe('Feature: View Trustee Details (Full Stack)', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  afterEach(() => {
    clearAllRepositorySpies();
  });

  /**
   * Scenario: View trustee with complete contact information
   *
   * GIVEN a trustee exists with complete public and internal contact info
   * WHEN the user navigates to the trustee detail page
   * THEN all contact information should be displayed correctly
   *
   * Replaces:
   * - TrusteeDetailScreen.test.tsx: "should render trustee header"
   * - TrusteeDetailProfile.test.tsx: "should render public contact"
   * - trustees.test.ts: "should return a single trustee"
   */
  test('should display trustee with complete contact information', async () => {
    // GIVEN: A trustee with complete contact information
    const testTrustee = MockData.getTrustee({
      override: {
        trusteeId: '123',
        name: 'John Doe',
        public: {
          address: {
            address1: '123 Main St',
            address2: 'Suite 100',
            city: 'Anytown',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US',
          },
          email: 'john.doe@example.com',
          phone: { number: '555-123-4567', extension: '1234' },
        },
        internal: {
          address: {
            address1: '456 Internal Blvd',
            city: 'Internal City',
            state: 'CA',
            zipCode: '54321',
            countryCode: 'US',
          },
          email: 'john.internal@example.com',
          phone: { number: '555-987-6543' },
        },
      },
    });

    // WHEN: User navigates to trustee detail page
    await TestSetup
      .forUser(TestSessions.trusteeAdmin())
      .withTrustee(testTrustee)
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    await waitForAppLoad();

    // THEN: Trustee details should display
    await expectPageToContain('John Doe');

    // Public contact
    await expectPageToContain('123 Main St');
    await expectPageToContain('Suite 100');
    await expectPageToContain('Anytown, NY 12345');
    await expectPageToContain('john.doe@example.com');
    await expectPageToContain('555-123-4567, ext. 1234');

    // Internal contact
    await expectPageToContain('456 Internal Blvd');
    await expectPageToContain('Internal City, CA 54321');
    await expectPageToContain('john.internal@example.com');

    console.log('[TEST] ✓ Trustee details displayed successfully');
  }, 20000);

  /**
   * Scenario: View trustee with missing contact information
   *
   * GIVEN a trustee exists with incomplete contact info
   * WHEN the user views the trustee
   * THEN only available information is shown, missing fields are gracefully hidden
   *
   * Replaces:
   * - TrusteeDetailScreen.test.tsx: "should handle missing contact information"
   */
  test('should handle trustee with missing contact information', async () => {
    // GIVEN: A trustee with minimal contact information
    const testTrustee = MockData.getTrustee({
      override: {
        trusteeId: '456',
        name: 'Jane Smith',
        public: {
          phone: { number: '555-999-8888' },
          address: {
            address1: '', // Empty address
            city: '',
            state: '',
            zipCode: '',
            countryCode: 'US',
          },
        },
        // No internal contact
      },
    });

    // WHEN: User navigates to trustee page
    await TestSetup
      .forUser(TestSessions.trusteeAdmin())
      .withTrustee(testTrustee)
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    await waitForAppLoad();

    // THEN: Name and phone display, but address/email are hidden
    await expectPageToContain('Jane Smith');
    await expectPageToContain('555-999-8888');

    console.log('[TEST] ✓ Missing contact information handled gracefully');
  }, 20000);

  /**
   * Scenario: Access denied for non-admin users
   *
   * GIVEN a user without TrusteeAdmin role
   * WHEN they try to access trustee detail page
   * THEN access should be denied
   *
   * Replaces:
   * - trustees.controller.test.tsx: "should deny access for users without role"
   */
  test('should deny access to non-admin users', async () => {
    // GIVEN: A non-admin user (trial attorney)
    const testTrustee = MockData.getTrustee({
      override: { trusteeId: '789', name: 'Test Trustee' },
    });

    // WHEN: Non-admin user tries to access trustee page
    await TestSetup
      .forUser(TestSessions.trialAttorney()) // Not a trustee admin
      .withTrustee(testTrustee)
      .renderAt(`/trustees/${testTrustee.trusteeId}`);

    await waitForAppLoad();

    // THEN: Access denied or 404 page should display
    await expectPageToMatch(/not found|access denied/i);

    console.log('[TEST] ✓ Access denied for non-admin user');
  }, 20000);

  // Additional scenarios...
});
```

### Extend Fluent API (If Needed)

If the feature needs new setup methods, extend the Fluent API:

**File:** `test/bdd/helpers/fluent-test-setup.ts`

```typescript
/**
 * Configure trustee data for the test
 */
withTrustee(trustee: Trustee): this {
  // Import and spy on the repository
  const { TrusteesMongoRepository } = require(
    '../../../../backend/lib/adapters/gateways/mongo/trustees.mongo.repository'
  );

  vi.spyOn(TrusteesMongoRepository.prototype, 'read')
    .mockResolvedValue(trustee);

  // Store in test state for stateful tests
  this.testState.trustees.set(trustee.trusteeId, trustee);

  return this;
}

/**
 * Configure list of trustees for search/list views
 */
withTrustees(trustees: Trustee[]): this {
  const { TrusteesMongoRepository } = require(
    '../../../../backend/lib/adapters/gateways/mongo/trustees.mongo.repository'
  );

  vi.spyOn(TrusteesMongoRepository.prototype, 'listTrustees')
    .mockResolvedValue(trustees);

  trustees.forEach(t => this.testState.trustees.set(t.trusteeId, t));

  return this;
}
```

### Add Test Fixtures (If Needed)

**File:** `test/bdd/fixtures/auth.fixtures.ts`

```typescript
export class TestSessions {
  // Existing sessions...

  static trusteeAdmin(): CamsSession {
    return {
      user: {
        id: 'trustee-admin-user',
        name: 'Trustee Admin User',
        roles: [CamsRole.TrusteeAdmin],
        offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
      },
      provider: 'mock',
      accessToken: 'mock-token',
      expires: new Date(Date.now() + 3600000).toISOString(),
    };
  }
}
```

---

## Step 5: Verify Coverage Equivalence

### Run BDD Tests with Coverage

```bash
# Run new BDD test with coverage
npm run test:bdd:coverage -- trustee-detail.spec.tsx

# Coverage will be in coverage/ directory
```

### Compare Coverage Reports

**Manual Comparison:**

Open both reports in browser:
```bash
# Baseline (unit tests)
open coverage-baseline/backend/index.html
open coverage-baseline/frontend/index.html

# BDD tests
open coverage/index.html
```

Navigate to specific files and compare line-by-line.

**Automated Comparison (JSON):**

```bash
# Extract coverage for specific file from both reports
echo "=== BASELINE (Unit Tests) ==="
cat coverage-baseline/backend/coverage-summary.json | \
  jq '.["backend/lib/use-cases/trustees/trustees.ts"]'

echo "=== BDD Tests ==="
cat coverage/coverage-summary.json | \
  jq '.["backend/lib/use-cases/trustees/trustees.ts"]'
```

### Create Comparison Document

**Template:**

```markdown
# Coverage Comparison: Trustee Detail View Migration

## Summary
- Unit Tests Replaced: 18
- BDD Scenarios Created: 6
- Migration Date: 2025-01-15

## Backend Coverage

### trustees.ts (Use Case)
| Metric | Baseline (Unit) | BDD | Delta | Status |
|--------|----------------|-----|-------|--------|
| Lines | 95.2% | 93.5% | -1.7% | ✅ Acceptable |
| Branches | 92.5% | 90.0% | -2.5% | ✅ Acceptable |
| Functions | 100% | 100% | 0% | ✅ Perfect |

**Notes:**
- Missing coverage on lines 145, 203 (error logging, not user-facing)
- Acceptable gap: internal implementation details

### trustees.controller.ts
| Metric | Baseline (Unit) | BDD | Delta | Status |
|--------|----------------|-----|-------|--------|
| Lines | 100% | 98.5% | -1.5% | ✅ Acceptable |
| Branches | 100% | 97.2% | -2.8% | ✅ Acceptable |
| Functions | 100% | 100% | 0% | ✅ Perfect |

**Notes:**
- Missing: PUT method error handling (unsupported HTTP method)
- Acceptable: Not a user-facing path

## Frontend Coverage

### TrusteeDetailScreen.tsx
| Metric | Baseline (Unit) | BDD | Delta | Status |
|--------|----------------|-----|-------|--------|
| Lines | 92.3% | 91.0% | -1.3% | ✅ Acceptable |
| Branches | 88.9% | 87.5% | -1.4% | ✅ Acceptable |
| Functions | 100% | 100% | 0% | ✅ Perfect |

**Notes:**
- Missing: Loading timeout edge case (lines 78-82)
- Acceptable: Rare timeout scenario

### TrusteeDetailProfile.tsx
| Metric | Baseline (Unit) | BDD | Delta | Status |
|--------|----------------|-----|-------|--------|
| Lines | 100% | 100% | 0% | ✅ Perfect |
| Branches | 100% | 100% | 0% | ✅ Perfect |
| Functions | 100% | 100% | 0% | ✅ Perfect |

**Notes:**
- Perfect match!

## Decision

✅ **APPROVED FOR MIGRATION**

- All critical paths covered
- Minor gaps are acceptable (implementation details)
- BDD tests provide higher confidence through full-stack integration
- Ready to remove unit tests after team review
```

### Iterate if Gaps Exist

If gaps are too large (>5% on critical paths):

1. **Identify missing scenarios:**
   - Look at uncovered lines in coverage report
   - Map back to unit tests that covered them
   - Determine if user-facing behavior

2. **Add BDD scenarios:**
   ```typescript
   test('should handle <missing scenario>', async () => {
     // Add scenario that covers the gap
   });
   ```

3. **Re-run coverage and compare**

4. **Document acceptable gaps:**
   - Implementation details (internal error logging)
   - Unsupported code paths (deprecated methods)
   - Pure utilities (may keep as unit tests)

---

## Step 6: Cleanup and Documentation

### Document Migration in Test File

At the top of BDD test file, document what was migrated:

```typescript
/**
 * BDD Feature: View Trustee Details (Full Stack)
 *
 * ...
 *
 * Replaces Unit Tests:
 * - user-interface/src/trustees/TrusteeDetailScreen.test.tsx (13 tests)
 *   ├─ Loading states (1 test) → Implicit in waitForAppLoad()
 *   ├─ Rendering (2 tests) → Scenario 1
 *   ├─ Missing contact (1 test) → Scenario 2
 *   ├─ Navigation (5 tests) → Scenarios 4, 5
 *   └─ Error handling (4 tests) → Scenario 6
 *
 * - backend/lib/use-cases/trustees/trustees.test.ts (2 tests)
 *   ├─ getTrustee success → Scenario 1
 *   └─ getTrustee error → Scenario 6
 *
 * - backend/lib/controllers/trustees/trustees.controller.test.ts (3 tests)
 *   ├─ GET /api/trustees/:id → Scenario 1 (implicit)
 *   ├─ Authorization → Scenario 3
 *   └─ Error responses → Scenario 6
 *
 * Total: 18 unit tests → 6 BDD scenarios
 * Migration Date: 2025-01-15
 * Coverage Comparison: See coverage-comparison-trustee-detail.md
 */
```

### Remove Unit Tests (With Approval)

**⚠️ IMPORTANT: Get team approval before deleting tests!**

1. **Create PR with:**
   - New BDD test file
   - Coverage comparison document
   - Migration documentation
   - **Keep unit tests in PR** (delete in separate step)

2. **After PR approval:**
   - Create follow-up PR to remove unit tests
   - Reference migration documentation
   - Link to coverage comparison

3. **Archive unit tests (optional):**
   ```bash
   # Move to archive instead of deleting (temporary safety)
   mkdir -p test/archived/unit-tests/trustees
   git mv user-interface/src/trustees/TrusteeDetailScreen.test.tsx \
          test/archived/unit-tests/trustees/
   ```

### Update Documentation

Update relevant docs:

**File:** `test/bdd/README.md`

```markdown
## Migrated Features

| Feature | BDD Test File | Unit Tests Removed | Date | Coverage Report |
|---------|---------------|-------------------|------|-----------------|
| Case Detail View | `case-management/case-detail.spec.tsx` | 12 tests | 2025-01-10 | [Report](../docs/coverage/case-detail-migration.md) |
| Trustee Detail View | `trustee-management/trustee-detail.spec.tsx` | 18 tests | 2025-01-15 | [Report](../docs/coverage/trustee-detail-migration.md) |
```

---

## Examples: Real Migrations

### Example 1: Case Detail View (Read-Only)

**Before (Unit Tests):**

```typescript
// backend/lib/use-cases/cases/cases.test.ts
test('should get case detail', async () => {
  const mockCase = MockData.getCaseDetail();
  vi.spyOn(gateway, 'getCaseDetail').mockResolvedValue(mockCase);

  const result = await casesUseCase.getCaseDetail(context, '123');

  expect(result).toEqual(mockCase);
});

// user-interface/src/case-detail/CaseDetailScreen.test.tsx
test('should render case title', () => {
  render(<CaseDetailScreen caseId="123" />);
  expect(screen.getByText('Test Case')).toBeInTheDocument();
});

test('should render case chapter', () => {
  render(<CaseDetailScreen caseId="123" />);
  expect(screen.getByText(/Chapter 11/i)).toBeInTheDocument();
});
```

**After (BDD Test):**

```typescript
// test/bdd/features/case-management/case-detail.spec.tsx
test('should display Chapter 11 case details', async () => {
  // GIVEN: A Chapter 11 case
  const testCase = MockData.getCaseDetail({
    override: {
      caseId: '081-23-12345',
      caseTitle: 'Test Corporation',
      chapter: '11',
    },
  });

  // WHEN: User navigates to case detail page
  await TestSetup
    .forUser(TestSessions.caseAssignmentManager())
    .withCase(testCase)
    .renderAt(`/case-detail/${testCase.caseId}`);

  await waitForAppLoad();

  // THEN: Case details should display
  await expectPageToContain(testCase.caseTitle);
  await expectPageToContain(testCase.caseId);
  await expectPageToMatch(/Chapter 11/i);
}, 20000);
```

**Result:** 2 backend tests + 2 frontend tests = **1 BDD scenario** with higher confidence

---

### Example 2: Case Notes (Write Operation with State)

**Before (Unit Tests):**

```typescript
// backend/lib/use-cases/case-notes/case-notes.test.ts
test('should create case note', async () => {
  const note = { caseId: '123', content: 'Test note' };
  vi.spyOn(repository, 'create').mockResolvedValue(note);

  const result = await caseNotesUseCase.create(context, note);

  expect(result).toEqual(note);
  expect(repository.create).toHaveBeenCalledWith(note);
});

// user-interface/src/case-detail/panels/CaseNotes.test.tsx
test('should show add note button', () => {
  render(<CaseNotes caseId="123" />);
  expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
});

test('should open modal when add button clicked', async () => {
  const user = userEvent.setup();
  render(<CaseNotes caseId="123" />);

  await user.click(screen.getByRole('button', { name: /add note/i }));

  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```

**After (BDD Test with State):**

```typescript
// test/bdd/features/case-management/case-notes.spec.tsx
test('should add a case note and display it', async () => {
  const user = userEvent.setup();

  // GIVEN: A case with no notes
  const testCase = MockData.getCaseDetail({
    override: { caseId: '081-23-12345' }
  });

  // Capture state for assertions
  const state = await TestSetup
    .forUser(TestSessions.trialAttorney())
    .withCase(testCase)
    .withCaseNotes(testCase.caseId, [])  // Empty initially
    .renderAt(`/case-detail/${testCase.caseId}`);

  await waitForAppLoad();
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

  // AND: Note should appear in UI
  await waitFor(() => {
    expect(screen.getByText(noteContent)).toBeInTheDocument();
  });
}, 30000);
```

**Result:** 1 backend test + 2 frontend tests = **1 BDD scenario** covering create + display + state

---

## Common Patterns

### Pattern 1: Read-Only Display Tests

**Scenario:** User views data (no writes)

**Characteristics:**
- Simple data setup with `.withCase()`, `.withTrustee()`, etc.
- No state capture needed
- Use `expectPageToContain()` for assertions

**Template:**
```typescript
test('should display <entity> details', async () => {
  const testEntity = MockData.getEntity({ override: { /* data */ } });

  await TestSetup
    .forUser(TestSessions.someRole())
    .withEntity(testEntity)
    .renderAt(`/entity/${testEntity.id}`);

  await waitForAppLoad();
  await expectPageToContain(testEntity.name);
}, 20000);
```

---

### Pattern 2: Write Operations with State Verification

**Scenario:** User creates/updates data

**Characteristics:**
- Capture `state` from `renderAt()`
- Use stateful setup methods with explicit `caseId`
- Assert on state: `state.expectNoteCount()`, `state.expectNoteExists()`
- Verify UI reflects changes

**Template:**
```typescript
test('should create <entity> and display it', async () => {
  const user = userEvent.setup();

  const state = await TestSetup
    .forUser(TestSessions.someRole())
    .withEntityList(entityId, [])
    .renderAt('/entity/page');

  await waitForAppLoad();
  state.expectEntityCount(entityId, 0);

  // Perform creation via UI
  await user.click(screen.getByRole('button', { name: /create/i }));
  await user.type(screen.getByLabelText(/name/i), 'New Entity');
  await user.click(screen.getByRole('button', { name: /save/i }));

  // Assert state changed
  state.expectEntityCount(entityId, 1);

  // Assert UI updated
  await expectPageToContain('New Entity');
}, 30000);
```

---

### Pattern 3: Error Handling

**Scenario:** System handles errors gracefully

**Characteristics:**
- Mock gateway to throw errors
- Verify error messages display
- Ensure system doesn't crash

**Template:**
```typescript
test('should handle <error condition> gracefully', async () => {
  // Mock error response
  const { EntityGateway } = await import('path/to/gateway');
  vi.spyOn(EntityGateway.prototype, 'getEntity')
    .mockRejectedValue(new Error('Entity not found'));

  await TestSetup
    .forUser(TestSessions.someRole())
    .renderAt('/entity/nonexistent');

  await waitForAppLoad();

  await expectPageToMatch(/not found|error/i);
}, 20000);
```

---

### Pattern 4: Authorization/Access Control

**Scenario:** Different roles have different access

**Characteristics:**
- Test with different user sessions
- Verify access granted/denied appropriately

**Template:**
```typescript
test('should allow <role> to access <feature>', async () => {
  await TestSetup
    .forUser(TestSessions.authorizedRole())
    .withEntity(testEntity)
    .renderAt('/entity/page');

  await waitForAppLoad();
  await expectPageToContain('Expected Content');
}, 20000);

test('should deny <role> access to <feature>', async () => {
  await TestSetup
    .forUser(TestSessions.unauthorizedRole())
    .renderAt('/entity/page');

  await waitForAppLoad();
  await expectPageToMatch(/access denied|not found/i);
}, 20000);
```

---

### Pattern 5: Navigation and Multi-Tab Views

**Scenario:** User navigates between tabs/pages

**Characteristics:**
- Render at specific routes
- Verify tab content displays correctly

**Template:**
```typescript
test.each([
  { route: '/entity/123/tab1', expectedText: 'Tab 1 Content' },
  { route: '/entity/123/tab2', expectedText: 'Tab 2 Content' },
  { route: '/entity/123/tab3', expectedText: 'Tab 3 Content' },
])('should display correct content for $route', async ({ route, expectedText }) => {
  const testEntity = MockData.getEntity({ override: { id: '123' } });

  await TestSetup
    .forUser(TestSessions.someRole())
    .withEntity(testEntity)
    .renderAt(route);

  await waitForAppLoad();
  await expectPageToContain(expectedText);
}, 20000);
```

---

### Pattern 6: Feature Flag Testing

**Scenario:** Testing features behind feature flags

**Characteristics:**
- Features gated by LaunchDarkly feature flags
- Need to enable/disable flags for specific tests

**Template:**
```typescript
test('should display feature when flag is enabled', async () => {
  const testEntity = MockData.getEntity({ override: { id: '123' } });

  await TestSetup
    .forUser(TestSessions.someRole())
    .withFeatureFlag('my-feature', true)  // Enable the feature flag
    .withEntity(testEntity)
    .renderAt('/entity/123');

  await waitForAppLoad();
  await expectPageToContain('Feature Content');
}, 20000);

test('should hide feature when flag is disabled', async () => {
  const testEntity = MockData.getEntity({ override: { id: '123' } });

  await TestSetup
    .forUser(TestSessions.someRole())
    .withFeatureFlag('my-feature', false)  // Disable the feature flag
    .withEntity(testEntity)
    .renderAt('/entity/123');

  await waitForAppLoad();
  await expectPageToMatch(/not available|coming soon/i);
}, 20000);

// Multiple feature flags
test('should enable multiple features', async () => {
  await TestSetup
    .forUser(TestSessions.someRole())
    .withFeatureFlags({
      'feature-one': true,
      'feature-two': true,
      'feature-three': false,
    })
    .renderAt('/');

  await waitForAppLoad();
  // Assert based on flag states
}, 20000);
```

**How Feature Flags Work:**
- **Backend**: Mocks `@launchdarkly/node-server-sdk` module
- **Frontend**: Mocks `launchdarkly-react-client-sdk` module
- **Default**: All flags in `common/src/feature-flags.ts` are enabled by default in tests
- **Override**: Use `.withFeatureFlag()` to override defaults for specific tests

**Common Feature Flags:**
- `trustee-management` - Trustee CRUD operations
- `privileged-identity-management` - Admin user elevation
- `chapter-eleven-enabled` - Chapter 11 case support
- `transfer-orders-enabled` - Case transfer functionality
- `consolidations-enabled` - Case consolidation functionality

---

## Troubleshooting

### Issue: BDD Test Coverage is Much Lower Than Baseline

**Symptom:** BDD coverage is 60%, baseline was 95%

**Possible Causes:**
1. Missing BDD scenarios for specific branches
2. Unit tests tested implementation details (not user-facing)
3. Mock configurations don't trigger code paths

**Solution:**
1. **Review uncovered lines:**
   ```bash
   # Open coverage report and find uncovered lines
   open coverage/index.html
   ```

2. **Map uncovered lines to unit tests:**
   - Find which unit test covered that line
   - Determine if it's user-facing behavior
   - Add BDD scenario if yes, document gap if no

3. **Add missing scenarios:**
   ```typescript
   test('should handle <uncovered scenario>', async () => {
     // New scenario to cover the gap
   });
   ```

---

### Issue: BDD Tests are Flaky (Intermittent Failures)

**Symptom:** Tests pass sometimes, fail other times

**Possible Causes:**
1. Race conditions (not waiting for async operations)
2. Test pollution (shared state between tests)
3. Timing issues

**Solution:**
1. **Add proper waits:**
   ```typescript
   // Instead of:
   expect(screen.getByText('Text')).toBeInTheDocument();

   // Use:
   await waitFor(() => {
     expect(screen.getByText('Text')).toBeInTheDocument();
   });
   ```

2. **Ensure cleanup:**
   ```typescript
   afterEach(() => {
     clearAllRepositorySpies(); // Clear spies between tests
   });
   ```

3. **Increase timeouts:**
   ```typescript
   test('scenario', async () => {
     // ...
   }, 30000); // 30 second timeout for complex tests
   ```

---

### Issue: Can't Find Specific Element in BDD Test

**Symptom:** `screen.getByText()` fails, but text is visible

**Possible Causes:**
1. Text is split across multiple DOM elements
2. Loading state hasn't completed
3. Text has special formatting (regex needed)

**Solution:**
1. **Use document.body.textContent:**
   ```typescript
   await waitFor(() => {
     const body = document.body.textContent || '';
     expect(body).toContain('Text');
   });
   ```

2. **Use regex for partial matches:**
   ```typescript
   await expectPageToMatch(/partial.*text/i);
   ```

3. **Wait for loading to complete:**
   ```typescript
   await waitForAppLoad(); // Waits for "Loading session" to disappear
   ```

---

### Issue: Coverage Report Shows Wrong Files

**Symptom:** Coverage includes unrelated files

**Possible Causes:**
1. Coverage tool is including all files by default
2. Need to filter coverage report

**Solution:**
1. **Extract coverage for specific files:**
   ```bash
   # Use jq to filter JSON coverage report
   cat coverage/coverage-summary.json | \
     jq '{
       "trustees.ts": .["backend/lib/use-cases/trustees/trustees.ts"],
       "trustees.controller.ts": .["backend/lib/controllers/trustees/trustees.controller.ts"]
     }'
   ```

2. **Configure coverage in vitest.config.ts:**
   ```typescript
   coverage: {
     include: [
       'backend/lib/use-cases/trustees/**',
       'backend/lib/controllers/trustees/**',
       'user-interface/src/trustees/**'
     ]
   }
   ```

---

### Issue: Fluent API Method Doesn't Exist

**Symptom:** `.withTrustee()` is not a function

**Possible Causes:**
1. Method not yet implemented
2. Import path incorrect

**Solution:**
1. **Add method to Fluent API:**
   - Edit `test/bdd/helpers/fluent-test-setup.ts`
   - Add method following existing patterns
   - Follow example in Step 4: "Extend Fluent API"

2. **Use existing patterns:**
   - Check `withCase()`, `withCaseNotes()` for examples
   - Follow same spy pattern

---

## Summary Checklist

### Pre-Migration
- [ ] Identify all unit tests for the feature
- [ ] Categorize tests by layer (backend/frontend)
- [ ] Map tests to user journeys
- [ ] Capture baseline coverage reports
- [ ] Document coverage targets

### Implementation
- [ ] Create BDD test file in appropriate feature directory
- [ ] Extend Fluent API if needed
- [ ] Add test fixtures (sessions, data) if needed
- [ ] Write BDD scenarios using Given/When/Then
- [ ] Ensure tests pass individually
- [ ] Run full BDD suite to check for pollution

### Verification
- [ ] Run BDD tests with coverage
- [ ] Compare coverage with baseline
- [ ] Document coverage comparison
- [ ] Iterate if gaps exist (add scenarios or document acceptable gaps)
- [ ] Get team review

### Cleanup
- [ ] Document migration in BDD test file
- [ ] Create PR with BDD tests (keep unit tests)
- [ ] After approval, create PR to remove unit tests
- [ ] Update test documentation (README, migration log)

---

## Additional Resources

- **Writing BDD Tests**: See `test/bdd/AI_TESTING_GUIDELINES.md`
- **Fluent API Reference**: See `test/bdd/FLUENT_API.md`
- **BDD Overview**: See `test/bdd/README.md`
- **Architecture Decision**: See `docs/architecture/decision-records/BddFullStackTesting.md`

---

## Questions to Ask Before Starting

1. **What feature am I migrating?**
   - Feature name: _________________
   - User role: _________________
   - Primary actions: _________________

2. **What are the source files under test?**
   - Backend files: _________________
   - Frontend files: _________________

3. **What unit tests exist?**
   - Backend test count: _____
   - Frontend test count: _____
   - Total: _____

4. **What are the main user journeys?**
   1. _________________
   2. _________________
   3. _________________

5. **Is this read-only or does it involve writes?**
   - [ ] Read-only (simpler, no state)
   - [ ] Write operations (need TestState)

6. **What test data/fixtures are needed?**
   - MockData helpers: _________________
   - Custom fixtures: _________________

7. **Are Fluent API extensions needed?**
   - [ ] No, existing methods sufficient
   - [ ] Yes, need to add: _________________

---

**End of Migration Guide**

For questions or issues, refer to existing BDD tests in `test/bdd/features/` for examples.
