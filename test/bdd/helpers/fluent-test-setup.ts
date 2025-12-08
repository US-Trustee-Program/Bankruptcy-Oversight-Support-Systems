/**
 * Fluent API for BDD Test Setup
 *
 * Provides a clean, declarative interface for setting up full-stack tests
 * without exposing the underlying spy and mock complexity.
 *
 * @example
 * ```typescript
 * // Case detail test
 * const testCase = MockData.getCaseDetail({ override: { caseId: '081-23-12345' } });
 * await TestSetup
 *   .forUser(TestSessions.caseAssignmentManager())
 *   .withCase(testCase)
 *   .renderAt(`/case-detail/${testCase.caseId}`);
 *
 * // Search test
 * const cases = [MockData.getCaseSummary({ ... })];
 * await TestSetup
 *   .forUser(TestSessions.trialAttorney())
 *   .withSearchResults(cases)
 *   .renderAt('/');
 *
 * // My cases test
 * await TestSetup
 *   .forUser(TestSessions.caseAssignmentManager())
 *   .withMyAssignments(assignedCases)
 *   .renderAt('/my-cases');
 * ```
 */

import { vi } from 'vitest';
import type { CamsSession } from '@common/cams/session';
import type { CaseDetail, CaseSummary } from '@common/cams/cases';
import type { CaseAssignment } from '@common/cams/assignments';
import type { TransferFrom, TransferTo, ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { renderApp } from './render-with-context';
import { clearAllRepositorySpies, spyOnMeEndpoint, spyOnAllGateways } from './repository-spies';

type Transfer = TransferFrom | TransferTo;
type Consolidation = ConsolidationFrom | ConsolidationTo;

/**
 * Fluent test setup builder for BDD full-stack tests.
 *
 * Handles all the complexity of:
 * - Clearing previous spies
 * - Setting up authentication (/me endpoint)
 * - Configuring gateway/repository spies
 * - Rendering the application
 *
 * Usage:
 * 1. Start with `TestSetup.forUser(session)`
 * 2. Chain data methods (`.withCase()`, `.withSearchResults()`, etc.)
 * 3. End with `.renderAt(route)` to render the app
 */
export class TestSetup {
  private session: CamsSession;
  private cases: CaseDetail[] = [];
  private searchResults: CaseSummary[] = [];
  private myAssignments: CaseSummary[] = [];
  private transfers: Transfer[] = [];
  private consolidations: Consolidation[] = [];
  private assignmentMap: Map<string, CaseAssignment[]> = new Map();
  private docketEntries: any[] = [];
  private caseNotes: any[] = [];
  private offices: any[] = [];
  private customSpies: Record<string, any> = {};

  private constructor(session: CamsSession) {
    this.session = session;
  }

  /**
   * Start building a test setup for a specific user session.
   *
   * @param session The user session (use TestSessions.* helpers)
   * @example
   * ```typescript
   * TestSetup.forUser(TestSessions.caseAssignmentManager())
   * ```
   */
  static forUser(session: CamsSession): TestSetup {
    return new TestSetup(session);
  }

  /**
   * Provide a single case detail for the test.
   * This will mock getCaseDetail() to return this case.
   *
   * @param caseDetail The case to use in the test
   * @example
   * ```typescript
   * const testCase = MockData.getCaseDetail({ override: { caseId: '081-23-12345' } });
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withCase(caseDetail: CaseDetail): TestSetup {
    this.cases = [caseDetail];
    return this;
  }

  /**
   * Provide multiple cases for the test.
   * This will mock getCaseDetail() to return the matching case by caseId.
   *
   * @param cases Array of cases to use
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCases([case1, case2, case3])
   *   .renderAt('/');
   * ```
   */
  withCases(cases: CaseDetail[]): TestSetup {
    this.cases = cases;
    return this;
  }

  /**
   * Provide search results for the test.
   * This will mock searchCases() to return these results.
   *
   * @param results Array of case summaries to return from search
   * @example
   * ```typescript
   * const results = [
   *   MockData.getCaseSummary({ override: { chapter: '15' } }),
   *   MockData.getCaseSummary({ override: { chapter: '15' } }),
   * ];
   * await TestSetup
   *   .forUser(session)
   *   .withSearchResults(results)
   *   .renderAt('/');
   * ```
   */
  withSearchResults(results: CaseSummary[]): TestSetup {
    this.searchResults = results;
    return this;
  }

  /**
   * Provide "my cases" assignments for the test.
   * This will mock findAssignmentsByAssignee() to return these cases.
   *
   * @param assignments Array of case summaries assigned to the user
   * @example
   * ```typescript
   * const myAssignedCases = [
   *   MockData.getCaseSummary({ override: { caseId: '081-23-11111' } }),
   * ];
   * await TestSetup
   *   .forUser(session)
   *   .withMyAssignments(myAssignedCases)
   *   .renderAt('/my-cases');
   * ```
   */
  withMyAssignments(assignments: CaseSummary[]): TestSetup {
    this.myAssignments = assignments;
    return this;
  }

  /**
   * Provide transfer data for case enrichment.
   *
   * @param transfers Array of transfers to return
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .withTransfers([{ orderType: 'transfer', status: 'approved' }])
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withTransfers(transfers: Transfer[]): TestSetup {
    this.transfers = transfers;
    return this;
  }

  /**
   * Provide consolidation data for case enrichment.
   *
   * @param consolidations Array of consolidations to return
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .withConsolidations([{ consolidationType: 'administrative' }])
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withConsolidations(consolidations: Consolidation[]): TestSetup {
    this.consolidations = consolidations;
    return this;
  }

  /**
   * Provide case assignments map for enriching case data.
   *
   * @param caseId The case ID
   * @param assignments Assignments for this case
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .withCaseAssignments(testCase.caseId, [assignment1, assignment2])
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withCaseAssignments(caseId: string, assignments: CaseAssignment[]): TestSetup {
    this.assignmentMap.set(caseId, assignments);
    return this;
  }

  /**
   * Provide docket entries for case detail.
   *
   * @param entries Array of docket entries
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .withDocketEntries([entry1, entry2])
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withDocketEntries(entries: any[]): TestSetup {
    this.docketEntries = entries;
    return this;
  }

  /**
   * Provide case notes.
   *
   * @param notes Array of case notes
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .withCaseNotes([note1, note2])
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withCaseNotes(notes: any[]): TestSetup {
    this.caseNotes = notes;
    return this;
  }

  /**
   * Provide offices for search filters.
   *
   * @param offices Array of offices
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withOffices([office1, office2])
   *   .renderAt('/');
   * ```
   */
  withOffices(offices: any[]): TestSetup {
    this.offices = offices;
    return this;
  }

  /**
   * Add custom spy configurations for gateways not covered by the fluent API.
   *
   * @param gatewayName Name of the gateway (e.g., 'CasesDxtrGateway')
   * @param methods Object with method name and mock implementation
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCustomSpy('AcmsGatewayImpl', {
   *     syncConsolidationOrders: vi.fn().mockResolvedValue([]),
   *   })
   *   .renderAt('/');
   * ```
   */
  withCustomSpy(gatewayName: string, methods: Record<string, any>): TestSetup {
    this.customSpies[gatewayName] = methods;
    return this;
  }

  /**
   * Render the application at the specified route with all configured mocks.
   * This is the terminal operation that:
   * 1. Clears previous spies
   * 2. Sets up authentication
   * 3. Configures all gateway/repository spies
   * 4. Renders the app at the specified route
   *
   * @param route The initial route to render (e.g., '/', '/case-detail/081-23-12345')
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  async renderAt(route: string): Promise<void> {
    // Setup authentication
    await spyOnMeEndpoint(this.session);

    // Build spy configuration
    const spyConfig: Record<string, any> = {
      // Cases gateway
      CasesDxtrGateway: {
        getCaseDetail: this.cases.length > 0
          ? vi.fn().mockImplementation(async (_context: any, caseId: string) => {
              const found = this.cases.find(c => c.caseId === caseId);
              if (!found) {
                throw new Error(`Case ${caseId} not found in test data`);
              }
              return found;
            })
          : undefined,
      },

      // Cases repository
      CasesMongoRepository: {
        searchCases: vi.fn().mockResolvedValue({
          metadata: { total: this.searchResults.length },
          data: this.searchResults,
        }),
        getTransfers: vi.fn().mockResolvedValue(this.transfers),
        getConsolidation: vi.fn().mockResolvedValue(this.consolidations),
        getCaseHistory: vi.fn().mockResolvedValue([]),
        getConsolidationChildCaseIds: vi.fn().mockResolvedValue([]),
      },

      // Case assignments
      CaseAssignmentMongoRepository: {
        findAssignmentsByAssignee: this.myAssignments.length > 0
          ? vi.fn().mockResolvedValue(this.myAssignments)
          : vi.fn().mockResolvedValue([]),
        getAssignmentsForCases: vi.fn().mockResolvedValue(this.assignmentMap),
      },

      // Offices
      OfficesDxtrGateway: {
        getOffices: vi.fn().mockResolvedValue(this.offices),
        getOfficeName: vi.fn().mockReturnValue('Test Office Name'),
      },
      OfficesMongoRepository: {
        getOfficeAttorneys: vi.fn().mockResolvedValue([]),
      },

      // Docket
      DxtrCaseDocketGateway: {
        getCaseDocket: vi.fn().mockResolvedValue(this.docketEntries),
      },

      // Case notes
      CaseNotesMongoRepository: {
        read: vi.fn().mockResolvedValue(this.caseNotes),
        getNotesByCaseId: vi.fn().mockResolvedValue(this.caseNotes),
      },

      // Session cache
      UserSessionCacheMongoRepository: {
        read: vi.fn().mockResolvedValue(this.session),
      },

      // Custom spies
      ...this.customSpies,
    };

    // Remove undefined methods from config
    Object.keys(spyConfig).forEach(gateway => {
      Object.keys(spyConfig[gateway]).forEach(method => {
        if (spyConfig[gateway][method] === undefined) {
          delete spyConfig[gateway][method];
        }
      });
    });

    // Setup comprehensive spies
    await spyOnAllGateways(spyConfig);

    // Render the app
    renderApp({
      initialRoute: route,
      session: this.session,
    });
  }
}

/**
 * Helper to wait for app loading to complete.
 * Use this after TestSetup.renderAt() before making assertions.
 *
 * @param timeout Maximum time to wait in milliseconds (default: 10000)
 * @example
 * ```typescript
 * await TestSetup
 *   .forUser(session)
 *   .withCase(testCase)
 *   .renderAt(`/case-detail/${testCase.caseId}`);
 *
 * await waitForAppLoad();
 *
 * // Now safe to assert
 * expect(document.body.textContent).toContain(testCase.caseTitle);
 * ```
 */
export async function waitForAppLoad(timeout: number = 10000): Promise<void> {
  const { waitFor } = await import('@testing-library/react');

  await waitFor(
    () => {
      const body = document.body.textContent || '';
      if (body.includes('Loading session')) {
        throw new Error('Still loading...');
      }
    },
    { timeout, interval: 500 },
  );
}

/**
 * Helper to wait for and assert page content.
 * Use this to verify expected content appears on the page.
 *
 * @param expectedText Text that should appear on the page
 * @param timeout Maximum time to wait (default: 10000ms)
 * @example
 * ```typescript
 * await TestSetup
 *   .forUser(session)
 *   .withCase(testCase)
 *   .renderAt(`/case-detail/${testCase.caseId}`);
 *
 * await expectPageToContain(testCase.caseTitle);
 * await expectPageToContain(testCase.caseId);
 * ```
 */
export async function expectPageToContain(expectedText: string, timeout: number = 10000): Promise<void> {
  const { waitFor } = await import('@testing-library/react');
  const { expect } = await import('vitest');

  await waitFor(
    () => {
      const body = document.body.textContent || '';
      expect(body).toContain(expectedText);
    },
    { timeout, interval: 500 },
  );
}

/**
 * Helper to wait for and assert page matches regex.
 *
 * @param pattern Regex pattern to match
 * @param timeout Maximum time to wait (default: 10000ms)
 * @example
 * ```typescript
 * await TestSetup
 *   .forUser(session)
 *   .withCase(testCase)
 *   .renderAt(`/case-detail/${testCase.caseId}`);
 *
 * await expectPageToMatch(/Chapter 7/i);
 * ```
 */
export async function expectPageToMatch(pattern: RegExp, timeout: number = 10000): Promise<void> {
  const { waitFor } = await import('@testing-library/react');
  const { expect } = await import('vitest');

  await waitFor(
    () => {
      const body = document.body.textContent || '';
      expect(body).toMatch(pattern);
    },
    { timeout, interval: 500 },
  );
}
