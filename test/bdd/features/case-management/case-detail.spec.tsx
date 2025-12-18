import { describe, beforeAll, afterAll, afterEach } from 'vitest';
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
 * BDD Feature: View Case Details (Full Stack)
 *
 * As a USTP user
 * I want to view detailed information about a bankruptcy case
 * So that I can make informed decisions about case management
 *
 * This test suite exercises the COMPLETE stack:
 * - React components (CaseDetailScreen)
 * - API client (api2.ts)
 * - Express server
 * - Controllers (CasesController)
 * - Use cases (CaseManagement)
 * - Mocked gateways/repositories (spied production code)
 *
 * Code Coverage:
 * - user-interface/src/case-detail/
 * - backend/lib/controllers/cases/
 * - backend/lib/use-cases/cases/
 */
describe('Feature: View Case Details (Full Stack)', () => {
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
   * Scenario: User views a Chapter 11 case
   *
   * GIVEN a Chapter 11 case exists
   * WHEN the user navigates to the case detail page
   * THEN the case information should be displayed
   */
  test('should display Chapter 11 case details', async () => {
    // GIVEN: A Chapter 11 case
    const testCase = MockData.getCaseDetail({
      override: {
        caseId: '081-23-12345',
        caseTitle: 'Test Corporation',
        chapter: '11',
        officeName: 'Manhattan',
        officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
        courtDivisionName: 'Manhattan',
      },
    });

    // WHEN: User navigates to case detail page
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withCase(testCase)
      .withTransfers(testCase.caseId, [])
      .withConsolidations(testCase.caseId, [])
      .renderAt(`/case-detail/${testCase.caseId}`);

    await waitForAppLoad();

    // THEN: Case details should display
    await expectPageToContain(testCase.caseTitle);
    await expectPageToContain(testCase.caseId);
    await expectPageToMatch(/Chapter 11/i);

    console.log('[TEST] ✓ Case details displayed successfully');
  }, 20000);

  /**
   * Scenario: User views a Chapter 7 case
   *
   * GIVEN a Chapter 7 case exists
   * WHEN the user views the case
   * THEN Chapter 7 information should be displayed
   */
  test('should display Chapter 7 case correctly', async () => {
    // GIVEN: A Chapter 7 case
    const testCase = MockData.getCaseDetail({
      override: {
        caseId: '081-23-77777',
        caseTitle: 'Chapter 7 Test',
        chapter: '7',
        officeName: 'Manhattan',
        officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      },
    });

    // WHEN: User views the case
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withCase(testCase)
      .renderAt(`/case-detail/${testCase.caseId}`);

    await waitForAppLoad();

    // THEN: Chapter 7 info should display
    await expectPageToMatch(/Chapter 7/i);
    console.log('[TEST] ✓ Chapter 7 case displayed correctly');
  }, 20000);

  /**
   * Scenario: Different user roles can access cases
   *
   * GIVEN a case exists
   * WHEN a trial attorney views the case
   * THEN they should see the details
   */
  test('should allow trial attorney to view case', async () => {
    // GIVEN: A case
    const testCase = MockData.getCaseDetail({
      override: {
        caseId: '081-23-55555',
        caseTitle: 'Multi-Role Case',
        officeName: 'Manhattan',
        officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      },
    });

    // WHEN: Trial attorney views case
    await TestSetup.forUser(TestSessions.trialAttorney())
      .withCase(testCase)
      .renderAt(`/case-detail/${testCase.caseId}`);

    await waitForAppLoad();

    // THEN: Details should display
    await expectPageToContain(testCase.caseTitle);
    console.log('[TEST] ✓ Trial attorney can view case details');
  }, 20000);

  /**
   * Scenario: Chapter 11 case display
   *
   * GIVEN a Chapter 11 case exists
   * WHEN the user views the case
   * THEN the case information should be displayed correctly
   */
  test('should display Chapter 11 case information', async () => {
    // GIVEN: A Chapter 11 case
    const testCase = MockData.getCaseDetail({
      override: {
        caseId: '081-23-99999',
        caseTitle: 'Complex Case',
        chapter: '11',
        officeName: 'Manhattan',
        officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      },
    });

    // WHEN: User views the case
    await TestSetup.forUser(TestSessions.caseAssignmentManager())
      .withCase(testCase)
      .withTransfers(testCase.caseId, [])
      .withConsolidations(testCase.caseId, [])
      .renderAt(`/case-detail/${testCase.caseId}`);

    await waitForAppLoad();

    // THEN: Case should display
    await expectPageToContain(testCase.caseTitle);
    console.log('[TEST] ✓ Chapter 11 case displayed successfully');
  }, 20000);
});
