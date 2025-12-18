import { describe, expect, afterEach } from 'vitest';
import { TestSetup } from './fluent-test-setup';
import { TestSessions } from '../fixtures/auth.fixtures';
import MockData from '@common/cams/test-utilities/mock-data';
import { clearAllRepositorySpies } from './repository-spies';

/**
 * Focused tests for the TestSetup fluent API
 *
 * These tests validate the core fluent API behavior of our BDD test infrastructure
 * independently of feature specs, making regressions easier to detect.
 *
 * IMPORTANT: These tests validate the fluent API structure and chaining WITHOUT
 * actually calling renderAt() to avoid rendering React components and async cleanup issues.
 * The actual rendering behavior is tested by the feature specs.
 *
 * We test:
 * - Fluent API chaining works correctly
 * - Methods return correct types for chaining
 * - Multiple data sources can be configured
 * - API surface is complete
 */
describe('TestSetup fluent API', () => {
  afterEach(() => {
    // Clean up spies after each test
    clearAllRepositorySpies();
  });

  describe('API structure validation', () => {
    test('forUser returns TestSetup instance with expected methods', () => {
      const session = TestSessions.caseAssignmentManager();
      const setup = TestSetup.forUser(session);

      expect(setup).toBeInstanceOf(TestSetup);
      expect(typeof setup.withCase).toBe('function');
      expect(typeof setup.withCases).toBe('function');
      expect(typeof setup.withSearchResults).toBe('function');
      expect(typeof setup.withMyAssignments).toBe('function');
      expect(typeof setup.withTransfers).toBe('function');
      expect(typeof setup.withConsolidations).toBe('function');
      expect(typeof setup.withCaseAssignments).toBe('function');
      expect(typeof setup.withDocketEntries).toBe('function');
      expect(typeof setup.withCaseNotes).toBe('function');
      expect(typeof setup.withOffices).toBe('function');
      expect(typeof setup.withCustomSpy).toBe('function');
      expect(typeof setup.renderAt).toBe('function');
    });

    test('validates forUser accepts different user session types', () => {
      expect(() => TestSetup.forUser(TestSessions.caseAssignmentManager())).not.toThrow();
      expect(() => TestSetup.forUser(TestSessions.trialAttorney())).not.toThrow();
      expect(() => TestSetup.forUser(TestSessions.dataVerifier())).not.toThrow();
      expect(() => TestSetup.forUser(TestSessions.superUser())).not.toThrow();
      expect(() => TestSetup.forUser(TestSessions.readOnlyUser())).not.toThrow();
    });
  });

  describe('fluent API chaining', () => {
    test('withCase returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const testCase = MockData.getCaseDetail({
        override: { caseId: 'TEST-001' },
      });

      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withCase(testCase);

      expect(setup2).toBe(setup1);
    });

    test('withCases returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const cases = [
        MockData.getCaseDetail({ override: { caseId: 'CASE-001' } }),
        MockData.getCaseDetail({ override: { caseId: 'CASE-002' } }),
      ];

      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withCases(cases);

      expect(setup2).toBe(setup1);
    });

    test('withSearchResults returns same instance for chaining', () => {
      const session = TestSessions.trialAttorney();
      const searchResults = [MockData.getCaseSummary({ override: { caseId: 'SEARCH-001' } })];

      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withSearchResults(searchResults);

      expect(setup2).toBe(setup1);
    });

    test('withMyAssignments returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const assignments = [MockData.getCaseSummary({ override: { caseId: 'ASSIGN-001' } })];

      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withMyAssignments(assignments);

      expect(setup2).toBe(setup1);
    });

    test('withTransfers returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withTransfers('CASE-001', []);

      expect(setup2).toBe(setup1);
    });

    test('withConsolidations returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withConsolidations('CASE-001', []);

      expect(setup2).toBe(setup1);
    });

    test('withCaseAssignments returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withCaseAssignments('CASE-001', []);

      expect(setup2).toBe(setup1);
    });

    test('withDocketEntries returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withDocketEntries('CASE-001', []);

      expect(setup2).toBe(setup1);
    });

    test('withCaseNotes returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withCaseNotes('CASE-001', []);

      expect(setup2).toBe(setup1);
    });

    test('withOffices returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withOffices([]);

      expect(setup2).toBe(setup1);
    });

    test('withCustomSpy returns same instance for chaining', () => {
      const session = TestSessions.caseAssignmentManager();
      const setup1 = TestSetup.forUser(session);
      const setup2 = setup1.withCustomSpy('TestGateway', {});

      expect(setup2).toBe(setup1);
    });

    test('allows complex chaining of multiple methods', () => {
      const session = TestSessions.superUser();
      const testCase = MockData.getCaseDetail({ override: { caseId: 'COMPLEX-001' } });
      const searchResults = [MockData.getCaseSummary({ override: { caseId: 'SEARCH-001' } })];

      const setup = TestSetup.forUser(session)
        .withCase(testCase)
        .withSearchResults(searchResults)
        .withTransfers('COMPLEX-001', [])
        .withConsolidations('COMPLEX-001', [])
        .withOffices([])
        .withCustomSpy('TestGateway', {});

      // All methods should return same instance
      expect(setup).toBeInstanceOf(TestSetup);
      expect(setup.renderAt).toBeDefined();
    });
  });

  describe('data configuration', () => {
    test('accepts single case configuration', () => {
      const session = TestSessions.caseAssignmentManager();
      const testCase = MockData.getCaseDetail({
        override: {
          caseId: 'DATA-001',
          caseTitle: 'Data Test Case',
          chapter: '11',
        },
      });

      expect(() => {
        TestSetup.forUser(session).withCase(testCase);
      }).not.toThrow();
    });

    test('accepts multiple cases configuration', () => {
      const session = TestSessions.caseAssignmentManager();
      const cases = [
        MockData.getCaseDetail({ override: { caseId: 'MULTI-001' } }),
        MockData.getCaseDetail({ override: { caseId: 'MULTI-002' } }),
        MockData.getCaseDetail({ override: { caseId: 'MULTI-003' } }),
      ];

      expect(() => {
        TestSetup.forUser(session).withCases(cases);
      }).not.toThrow();
    });

    test('accepts search results configuration', () => {
      const session = TestSessions.trialAttorney();
      const searchResults = [
        MockData.getCaseSummary({ override: { caseId: 'SEARCH-001' } }),
        MockData.getCaseSummary({ override: { caseId: 'SEARCH-002' } }),
      ];

      expect(() => {
        TestSetup.forUser(session).withSearchResults(searchResults);
      }).not.toThrow();
    });

    test('accepts empty arrays for optional data', () => {
      const session = TestSessions.caseAssignmentManager();

      expect(() => {
        TestSetup.forUser(session)
          .withSearchResults([])
          .withMyAssignments([])
          .withTransfers('CASE-001', [])
          .withConsolidations('CASE-001', [])
          .withCaseAssignments('CASE-001', [])
          .withDocketEntries('CASE-001', [])
          .withCaseNotes('CASE-001', [])
          .withOffices([]);
      }).not.toThrow();
    });
  });
});
