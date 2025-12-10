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
import { spyOnMeEndpoint, spyOnAllGateways } from './repository-spies';
import { TestState } from './test-state';

type Transfer = TransferFrom | TransferTo;
type Consolidation = ConsolidationFrom | ConsolidationTo;

/**
 * Fluent test setup builder for BDD full-stack tests.
 *
 * Handles all the complexity of:
 * - Setting up authentication (/me endpoint)
 * - Configuring gateway/repository spies
 * - Rendering the application
 *
 * Usage:
 * 1. Start with `TestSetup.forUser(session)`
 * 2. Chain data methods (`.withCase()`, `.withSearchResults()`, etc.)
 * 3. End with `.renderAt(route)` to render the app
 *
 * IMPORTANT: Spy Cleanup
 * This helper does NOT clear spies between tests. Callers are responsible for spy cleanup
 * to avoid cross-test leakage. Typically done by calling `clearAllRepositorySpies()` in
 * an `afterEach` hook within each test file.
 *
 * @example
 * ```typescript
 * // In your test file:
 * afterEach(() => {
 *   clearAllRepositorySpies();
 * });
 * ```
 */
export class TestSetup {
  private session: CamsSession;
  private state: TestState = new TestState();
  private cases: CaseDetail[] = [];
  private searchResults: CaseSummary[] = [];
  private searchResultsExplicitlySet: boolean = false;
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
    this.state.setCase(caseDetail);
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
    cases.forEach(c => this.state.setCase(c));
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
    this.searchResultsExplicitlySet = true;
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
   * @param caseId The case ID
   * @param transfers Array of transfers to return
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .withTransfers(testCase.caseId, [{ orderType: 'transfer', status: 'approved' }])
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withTransfers(caseId: string, transfers: Transfer[]): TestSetup {
    this.transfers = transfers;
    this.state.setTransfers(caseId, transfers);
    return this;
  }

  /**
   * Provide consolidation data for case enrichment.
   *
   * @param caseId The case ID
   * @param consolidations Array of consolidations to return
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .withConsolidations(testCase.caseId, [{ consolidationType: 'administrative' }])
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withConsolidations(caseId: string, consolidations: Consolidation[]): TestSetup {
    this.consolidations = consolidations;
    this.state.setConsolidations(caseId, consolidations);
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
    this.state.setAssignments(caseId, assignments);
    return this;
  }

  /**
   * Provide docket entries for case detail.
   *
   * @param caseId The case ID
   * @param entries Array of docket entries
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .withDocketEntries(testCase.caseId, [entry1, entry2])
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withDocketEntries(caseId: string, entries: any[]): TestSetup {
    this.docketEntries = entries;
    this.state.setDocketEntries(caseId, entries);
    return this;
  }

  /**
   * Provide case notes.
   *
   * @param caseId The case ID
   * @param notes Array of case notes
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .withCaseNotes(testCase.caseId, [note1, note2])
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   * ```
   */
  withCaseNotes(caseId: string, notes: any[]): TestSetup {
    this.caseNotes = notes;
    this.state.setNotes(caseId, notes);
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
   * 3. Configures all gateway/repository spies (including stateful spies)
   * 4. Renders the app at the specified route
   * 5. Returns TestState for assertions
   *
   * @param route The initial route to render (e.g., '/', '/case-detail/081-23-12345')
   * @returns TestState instance for stateful test assertions
   * @example
   * ```typescript
   * const state = await TestSetup
   *   .forUser(session)
   *   .withCase(testCase)
   *   .renderAt(`/case-detail/${testCase.caseId}`);
   *
   * // Use state for assertions
   * state.expectCaseExists(testCase.caseId);
   * ```
   */
  async renderAt(route: string): Promise<TestState> {
    // Setup authentication
    await spyOnMeEndpoint(this.session);

    // Build spy configuration
    // Note: State-aware spies are set up using TestState for reads/writes
    const state = this.state;

    const spyConfig: Record<string, any> = {
      // Cases gateway - STATE AWARE
      CasesDxtrGateway: {
        getCaseDetail: this.cases.length > 0
          ? vi.fn().mockImplementation(async (_context: any, caseId: string) => {
              // Read from state to get most current version
              const found = state.getCase(caseId);
              if (!found) {
                throw new Error(`Case ${caseId} not found in test data`);
              }
              return found;
            })
          : undefined,
      },

      // Cases repository - STATE AWARE for transfers/consolidations
      CasesMongoRepository: {
        // Only mock searchCases if withSearchResults() was explicitly called
        // This prevents accidental usage and makes tests explicit about their search data needs
        searchCases: this.searchResultsExplicitlySet
          ? vi.fn().mockResolvedValue({
              metadata: { total: this.searchResults.length },
              data: this.searchResults,
            })
          : undefined,
        // STATE AWARE: Read transfers from state
        getTransfers: vi.fn().mockImplementation(async (caseId: string) => {
          return state.getTransfers(caseId);
        }),
        // STATE AWARE: Read consolidations from state
        getConsolidation: vi.fn().mockImplementation(async (caseId: string) => {
          return state.getConsolidations(caseId);
        }),
        getCaseHistory: vi.fn().mockResolvedValue([]),
        getConsolidationChildCaseIds: vi.fn().mockResolvedValue([]),
      },

      // Case assignments - STATE AWARE
      CaseAssignmentMongoRepository: {
        findAssignmentsByAssignee: this.myAssignments.length > 0
          ? vi.fn().mockResolvedValue(this.myAssignments)
          : vi.fn().mockResolvedValue([]),
        // STATE AWARE: Read assignments from state
        getAssignmentsForCases: vi.fn().mockImplementation(async (caseIds: string[]) => {
          const assignmentMap = new Map<string, any[]>();
          caseIds.forEach(caseId => {
            assignmentMap.set(caseId, state.getAssignments(caseId));
          });
          return assignmentMap;
        }),
      },

      // Offices
      OfficesDxtrGateway: {
        getOffices: vi.fn().mockResolvedValue(this.offices),
        getOfficeName: vi.fn().mockReturnValue('Test Office Name'),
      },
      OfficesMongoRepository: {
        getOfficeAttorneys: vi.fn().mockResolvedValue([]),
      },

      // Docket - STATE AWARE
      DxtrCaseDocketGateway: {
        getCaseDocket: vi.fn().mockImplementation(async (caseId: string) => {
          return state.getDocketEntries(caseId);
        }),
      },

      // Case notes - handled by setupStatefulSpies()
      // CaseNotesMongoRepository spies are set up in setupStatefulSpies() for state awareness

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

    // Setup stateful spies for write operations
    await this.setupStatefulSpies();

    // Render the app
    renderApp({
      initialRoute: route,
      session: this.session,
    });

    return this.state;
  }

  /**
   * Set up stateful spies that read from and write to the TestState.
   * This enables testing of interactive workflows with writes and reads.
   *
   * READ operations return data from state.
   * WRITE operations update state and return success.
   */
  private async setupStatefulSpies(): Promise<void> {
    // Capture state in closure for use in spy implementations
    const state = this.state;

    // ============ CASE NOTES OPERATIONS ============

    const { CaseNotesMongoRepository } = await import(
      '../../../backend/lib/adapters/gateways/mongo/case-notes.mongo.repository'
    );

    // Spy on getNotesByCaseId() to return from state
    // Note: Repository returns ResourceActions<CaseNote>[] (notes with _actions property)
    vi.spyOn(CaseNotesMongoRepository.prototype, 'getNotesByCaseId').mockImplementation(
      async (caseId: string) => {
        const notes = state.getNotes(caseId);
        // Return notes as ResourceActions (they may have _actions added by use case)
        return notes as any[];
      },
    );

    // Spy on read() to return note by ID from state
    vi.spyOn(CaseNotesMongoRepository.prototype, 'read').mockImplementation(
      async (noteId: string) => {
        // Search all cases for the note with this ID
        const allCases = state.getAllCases();
        for (const caseDetail of allCases) {
          const notes = state.getNotes(caseDetail.caseId);
          const found = notes.find(n => n.id === noteId);
          if (found) return found;
        }
        throw new Error(`Note ${noteId} not found in test state`);
      },
    );

    // Spy on create() to add to state
    vi.spyOn(CaseNotesMongoRepository.prototype, 'create').mockImplementation(
      async (note: any) => {
        const noteWithId = {
          ...note,
          id: note.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdOn: note.createdOn || new Date().toISOString(),
          updatedOn: note.updatedOn || new Date().toISOString(),
          documentType: 'NOTE' as const,
        };
        state.addNote(noteWithId);
        return noteWithId;
      },
    );

    // Spy on update() to update state
    vi.spyOn(CaseNotesMongoRepository.prototype, 'update').mockImplementation(
      async (note: any) => {
        state.updateNote(note.id, note);
        return;
      },
    );

    // Spy on archiveCaseNote() to mark note as archived in state
    vi.spyOn(CaseNotesMongoRepository.prototype, 'archiveCaseNote').mockImplementation(
      async (archiveNote: any) => {
        state.updateNote(archiveNote.id, {
          archivedOn: archiveNote.archivedOn,
          archivedBy: archiveNote.archivedBy,
        });
        return { acknowledged: true, modifiedCount: 1 };
      },
    );

    // ============ ORDERS - TRANSFERS & CONSOLIDATIONS ============
    // Note: Only spy on methods if they exist in the repository

    const { OrdersMongoRepository } = await import(
      '../../../backend/lib/adapters/gateways/mongo/orders.mongo.repository'
    );

    // Spy on createTransferOrder() if it exists
    if (typeof OrdersMongoRepository.prototype['createTransferOrder'] === 'function') {
      vi.spyOn(OrdersMongoRepository.prototype, 'createTransferOrder' as any).mockImplementation(
        async (transfer: any) => {
          const transferWithId = {
            ...transfer,
            id: transfer.id || `transfer-${Date.now()}`,
            orderDate: transfer.orderDate || new Date().toISOString(),
          };
          state.addTransfer(transferWithId);
          return transferWithId;
        },
      );
    }

    // Spy on updateTransferOrder() if it exists
    if (typeof OrdersMongoRepository.prototype['updateTransferOrder'] === 'function') {
      vi.spyOn(OrdersMongoRepository.prototype, 'updateTransferOrder' as any).mockImplementation(
        async (transferId: string, updates: any) => {
          state.updateTransfer(transferId, updates);
          return { acknowledged: true, modifiedCount: 1 };
        },
      );
    }

    // Spy on createConsolidationOrder() if it exists
    if (typeof OrdersMongoRepository.prototype['createConsolidationOrder'] === 'function') {
      vi.spyOn(OrdersMongoRepository.prototype, 'createConsolidationOrder' as any).mockImplementation(
        async (consolidation: any) => {
          const consolidationWithId = {
            ...consolidation,
            id: consolidation.id || `consolidation-${Date.now()}`,
            orderDate: consolidation.orderDate || new Date().toISOString(),
          };
          state.addConsolidation(consolidationWithId);
          return consolidationWithId;
        },
      );
    }

    // ============ CASE ASSIGNMENTS ============
    // Note: Only spy on methods if they exist in the repository

    const { CaseAssignmentMongoRepository } = await import(
      '../../../backend/lib/adapters/gateways/mongo/case-assignment.mongo.repository'
    );

    // Spy on createCaseAssignment() if it exists
    if (typeof CaseAssignmentMongoRepository.prototype['createCaseAssignment'] === 'function') {
      vi.spyOn(CaseAssignmentMongoRepository.prototype, 'createCaseAssignment' as any).mockImplementation(
        async (assignment: any) => {
          const assignmentWithId = {
            ...assignment,
            id: assignment.id || `assignment-${Date.now()}`,
            createdAt: assignment.createdAt || new Date().toISOString(),
          };
          state.assignAttorney(assignment.caseId, assignmentWithId);
          return assignmentWithId;
        },
      );
    }

    // Spy on deleteCaseAssignment() if it exists
    if (typeof CaseAssignmentMongoRepository.prototype['deleteCaseAssignment'] === 'function') {
      vi.spyOn(CaseAssignmentMongoRepository.prototype, 'deleteCaseAssignment' as any).mockImplementation(
        async (caseId: string, attorneyId: string) => {
          state.unassignAttorney(caseId, attorneyId);
          return { acknowledged: true, deletedCount: 1 };
        },
      );
    }
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
