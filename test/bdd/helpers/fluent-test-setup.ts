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
import type { CaseDetail, CaseSummary, CaseNote } from '@common/cams/cases';
import type { CaseAssignment } from '@common/cams/assignments';
import type {
  TransferFrom,
  TransferTo,
  ConsolidationFrom,
  ConsolidationTo,
} from '@common/cams/events';
import type { Trustee, TrusteeHistory } from '@common/cams/trustees';
import type { UpdateResult } from '@backend/lib/use-cases/gateways.types.ts';
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
  private docketEntries: unknown[] = [];
  private caseNotes: unknown[] = [];
  private offices: unknown[] = [];
  private trustees: Trustee[] = [];
  private trusteeHistory: Map<string, TrusteeHistory[]> = new Map();
  private featureFlags: Record<string, boolean> = {};
  private customSpies: Record<string, Record<string, unknown>> = {};

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
    cases.forEach((c) => this.state.setCase(c));
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
  withDocketEntries(caseId: string, entries: unknown[]): TestSetup {
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
  withCaseNotes(caseId: string, notes: unknown[]): TestSetup {
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
  withOffices(offices: unknown[]): TestSetup {
    this.offices = offices;
    return this;
  }

  /**
   * Provide a single trustee for the test.
   * This will mock the TrusteesMongoRepository read() method to return this trustee.
   *
   * @param trustee The trustee to use in the test
   * @example
   * ```typescript
   * const testTrustee = MockData.getTrustee({ override: { trusteeId: '123' } });
   * await TestSetup
   *   .forUser(TestSessions.trusteeAdmin())
   *   .withTrustee(testTrustee)
   *   .renderAt(`/trustees/${testTrustee.trusteeId}`);
   * ```
   */
  withTrustee(trustee: Trustee): TestSetup {
    this.trustees = [trustee];
    return this;
  }

  /**
   * Provide multiple trustees for the test.
   * This will mock listTrustees() and read() to return the matching trustee by trusteeId.
   *
   * @param trustees Array of trustees to use
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(TestSessions.trusteeAdmin())
   *   .withTrustees([trustee1, trustee2, trustee3])
   *   .renderAt('/trustees');
   * ```
   */
  withTrustees(trustees: Trustee[]): TestSetup {
    this.trustees = trustees;
    return this;
  }

  /**
   * Provide audit/change history for a specific trustee.
   * This will mock the TrusteesMongoRepository listTrusteeHistory() method.
   *
   * @param trusteeId The trustee ID to associate history with
   * @param history Array of TrusteeHistory records (defaults to empty array if not provided)
   * @example
   * ```typescript
   * const history = MockData.getTrusteeHistory(); // or []
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

  /**
   * Enable a feature flag for the test.
   * Feature flags control access to features in the application.
   *
   * @param flagName Name of the feature flag (e.g., 'trustee-management')
   * @param enabled Whether the flag is enabled (default: true)
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(TestSessions.trusteeAdmin())
   *   .withFeatureFlag('trustee-management')
   *   .withTrustee(testTrustee)
   *   .renderAt('/trustees/123');
   * ```
   */
  withFeatureFlag(flagName: string, enabled: boolean = true): TestSetup {
    this.featureFlags[flagName] = enabled;
    return this;
  }

  /**
   * Enable multiple feature flags for the test.
   *
   * @param flags Object with flag names as keys and enabled state as values
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(session)
   *   .withFeatureFlags({
   *     'trustee-management': true,
   *     'case-consolidation': true,
   *   })
   *   .renderAt('/');
   * ```
   */
  withFeatureFlags(flags: Record<string, boolean>): TestSetup {
    Object.assign(this.featureFlags, flags);
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
  withCustomSpy(gatewayName: string, methods: Record<string, unknown>): TestSetup {
    this.customSpies[gatewayName] = methods;
    return this;
  }

  /**
   * Set up common mocks for screens that typically load after authentication.
   * This mocks the API calls that are commonly made on various authenticated screens,
   * such as fetching user's assigned cases for My Cases screen, offices, and search results.
   *
   * Useful when testing screens that may load common data in the background,
   * preventing API errors even if that data isn't directly asserted.
   *
   * @example
   * ```typescript
   * await TestSetup
   *   .forUser(TestSessions.trusteeAdmin())
   *   .withCommonPostLoginMocks()
   *   .withTrustee(testTrustee)
   *   .renderAt(`/trustees/${testTrustee.trusteeId}`);
   * ```
   */
  withCommonPostLoginMocks(): TestSetup {
    // Mock My Cases screen - user's assigned cases
    if (!this.myAssignments.length) {
      this.myAssignments = []; // Empty list is fine - just avoids API error
    }

    // Mock search results to empty if not already set
    // This prevents errors if search screen is rendered
    if (!this.searchResultsExplicitlySet) {
      this.searchResults = [];
    }

    // Mock offices - typically loaded on various screens
    if (!this.offices.length) {
      this.offices = [
        {
          officeName: 'Manhattan',
          officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
          regionId: '02',
          regionName: 'New York',
        },
      ];
    }

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

    // Setup feature flags if any were specified
    if (Object.keys(this.featureFlags).length > 0) {
      await this.setupFeatureFlagSpies();
    }

    // Build spy configuration
    // Note: State-aware spies are set up using TestState for reads/writes
    const state = this.state;

    const spyConfig: Record<string, Record<string, unknown>> = {
      // Cases gateway - STATE AWARE
      CasesDxtrGateway: {
        getCaseDetail:
          this.cases.length > 0
            ? vi.fn().mockImplementation(async (_context: unknown, caseId: string) => {
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
        findAssignmentsByAssignee:
          this.myAssignments.length > 0
            ? vi.fn().mockResolvedValue(this.myAssignments)
            : vi.fn().mockResolvedValue([]),
        // STATE AWARE: Read assignments from state
        getAssignmentsForCases: vi.fn().mockImplementation(async (caseIds: string[]) => {
          const assignmentMap = new Map<string, CaseAssignment[]>();
          caseIds.forEach((caseId) => {
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

      // Trustees
      TrusteesMongoRepository: {
        read:
          this.trustees.length > 0
            ? async (trusteeId: string) => {
                const found = this.trustees.find((t) => t.trusteeId === trusteeId);
                if (!found) {
                  throw new Error(`Trustee ${trusteeId} not found in test data`);
                }
                return found;
              }
            : undefined,
        listTrustees: this.trustees.length > 0 ? async () => this.trustees : async () => [],
        listTrusteeHistory:
          this.trusteeHistory.size > 0
            ? async (trusteeId: string) => {
                return this.trusteeHistory.get(trusteeId) || [];
              }
            : async () => [],
      },

      // Lists Repository (for bankruptcy software, courts, etc.)
      ListsMongoRepository: {
        // Mock getList with list-aware behavior
        getList: vi.fn().mockImplementation(async (listName: string) => {
          // Return different data based on the list name
          switch (listName) {
            case 'bankruptcy-software':
              return [
                { _id: '1', list: 'bankruptcy-software', key: 'BestCase', value: 'BestCase' },
                {
                  _id: '2',
                  list: 'bankruptcy-software',
                  key: 'NextChapter',
                  value: 'NextChapter',
                },
              ];
            case 'courts':
              // Return empty for courts - tests can override if needed
              return [];
            default:
              // Throw for unknown lists to surface unexpected usage
              throw new Error(
                `[BDD TEST] Unexpected list requested: "${listName}". ` +
                  `Add this list to ListsMongoRepository mock in fluent-test-setup.ts or override with .withCustomSpy()`,
              );
          }
        }),
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
    Object.keys(spyConfig).forEach((gateway) => {
      Object.keys(spyConfig[gateway]).forEach((method) => {
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

    const { CaseNotesMongoRepository } =
      await import('../../../backend/lib/adapters/gateways/mongo/case-notes.mongo.repository');

    // Spy on getNotesByCaseId() to return from state
    // Note: Repository returns CaseNote[] which may have _actions property added by use case layer
    vi.spyOn(CaseNotesMongoRepository.prototype, 'getNotesByCaseId').mockImplementation(
      async (caseId: string): Promise<CaseNote[]> => {
        return state.getNotes(caseId);
      },
    );

    // Spy on read() to return note by ID from state
    vi.spyOn(CaseNotesMongoRepository.prototype, 'read').mockImplementation(
      async (noteId: string): Promise<CaseNote> => {
        // Search all cases for the note with this ID
        const allCases = state.getAllCases();
        for (const caseDetail of allCases) {
          const notes = state.getNotes(caseDetail.caseId);
          const found = notes.find((n) => n.id === noteId);
          if (found) return found;
        }
        throw new Error(`Note ${noteId} not found in test state`);
      },
    );

    // Spy on create() to add to state
    vi.spyOn(CaseNotesMongoRepository.prototype, 'create').mockImplementation(
      async (note: CaseNote): Promise<CaseNote> => {
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
      async (note: Partial<CaseNote>): Promise<void> => {
        state.updateNote(note.id!, note);
        return;
      },
    );

    // Spy on archiveCaseNote() to mark note as archived in state
    vi.spyOn(CaseNotesMongoRepository.prototype, 'archiveCaseNote').mockImplementation(
      async (archiveNote: Partial<CaseNote>): Promise<UpdateResult> => {
        state.updateNote(archiveNote.id!, {
          archivedOn: archiveNote.archivedOn,
          archivedBy: archiveNote.archivedBy,
        });
        return { modifiedCount: 1, matchedCount: 1 };
      },
    );

    // ============ ORDERS - TRANSFERS & CONSOLIDATIONS ============
    // Note: Only spy on methods if they exist in the repository

    const { OrdersMongoRepository } =
      await import('../../../backend/lib/adapters/gateways/mongo/orders.mongo.repository');

    // Spy on createTransferOrder() if it exists
    if (typeof OrdersMongoRepository.prototype['createTransferOrder'] === 'function') {
      vi.spyOn(
        OrdersMongoRepository.prototype,
        'createTransferOrder' as keyof typeof OrdersMongoRepository.prototype,
      ).mockImplementation(async (transfer: Transfer): Promise<Transfer> => {
        const transferWithId = {
          ...transfer,
          id: transfer.id || `transfer-${Date.now()}`,
          orderDate: transfer.orderDate || new Date().toISOString(),
        };
        state.addTransfer(transferWithId);
        return transferWithId;
      });
    }

    // Spy on updateTransferOrder() if it exists
    if (typeof OrdersMongoRepository.prototype['updateTransferOrder'] === 'function') {
      vi.spyOn(
        OrdersMongoRepository.prototype,
        'updateTransferOrder' as keyof typeof OrdersMongoRepository.prototype,
      ).mockImplementation(async (transferId: string, updates: Partial<Transfer>) => {
        state.updateTransfer(transferId, updates);
        return { modifiedCount: 1, matchedCount: 1 };
      });
    }

    // Spy on createConsolidationOrder() if it exists
    if (typeof OrdersMongoRepository.prototype['createConsolidationOrder'] === 'function') {
      vi.spyOn(
        OrdersMongoRepository.prototype,
        'createConsolidationOrder' as keyof typeof OrdersMongoRepository.prototype,
      ).mockImplementation(async (consolidation: Consolidation): Promise<Consolidation> => {
        const consolidationWithId = {
          ...consolidation,
          id: consolidation.id || `consolidation-${Date.now()}`,
          orderDate: consolidation.orderDate || new Date().toISOString(),
        };
        state.addConsolidation(consolidationWithId);
        return consolidationWithId;
      });
    }

    // ============ CASE ASSIGNMENTS ============
    // Note: Only spy on methods if they exist in the repository

    const { CaseAssignmentMongoRepository } =
      await import('../../../backend/lib/adapters/gateways/mongo/case-assignment.mongo.repository');

    // Spy on createCaseAssignment() if it exists
    if (typeof CaseAssignmentMongoRepository.prototype['createCaseAssignment'] === 'function') {
      vi.spyOn(
        CaseAssignmentMongoRepository.prototype,
        'createCaseAssignment' as keyof typeof CaseAssignmentMongoRepository.prototype,
      ).mockImplementation(async (assignment: CaseAssignment): Promise<CaseAssignment> => {
        const assignmentWithId = {
          ...assignment,
          id: assignment.id || `assignment-${Date.now()}`,
          assignedOn: assignment.assignedOn || new Date().toISOString(),
        };
        state.assignAttorney(assignment.caseId, assignmentWithId);
        return assignmentWithId;
      });
    }

    // Spy on deleteCaseAssignment() if it exists
    if (typeof CaseAssignmentMongoRepository.prototype['deleteCaseAssignment'] === 'function') {
      vi.spyOn(
        CaseAssignmentMongoRepository.prototype,
        'deleteCaseAssignment' as keyof typeof CaseAssignmentMongoRepository.prototype,
      ).mockImplementation(async (caseId: string, attorneyId: string) => {
        state.unassignAttorney(caseId, attorneyId);
        return { deletedCount: 1 };
      });
    }
  }

  /**
   * Set up feature flag spies to override the default flags defined in driver-mocks.
   * This allows individual tests to enable specific feature flags.
   *
   * Uses spyOn to override the mocked LaunchDarkly modules that were hoisted in driver-mocks.
   */
  private async setupFeatureFlagSpies(): Promise<void> {
    // Spy on backend LaunchDarkly to return test-specific flags
    const backendLD = await import('@launchdarkly/node-server-sdk');

    // NOTE: This duplicates createMockLaunchDarklyClient from driver-mocks.ts
    // We cannot import and use the helper here due to module loading order issues
    // with dynamic imports. The helper is fine in hoisted vi.mock() calls.
    const mockClient = {
      waitForInitialization: vi.fn().mockResolvedValue(undefined),
      allFlagsState: vi.fn().mockResolvedValue({
        allValues: () => this.featureFlags,
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    vi.spyOn(backendLD, 'init').mockReturnValue(mockClient as never);
    if (backendLD.default) {
      vi.spyOn(backendLD.default, 'init').mockReturnValue(mockClient as never);
    }

    // Spy on frontend LaunchDarkly to return test-specific flags
    const frontendLD = await import('launchdarkly-react-client-sdk');
    vi.spyOn(frontendLD, 'useFlags').mockReturnValue(this.featureFlags);
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
export async function expectPageToContain(
  expectedText: string,
  timeout: number = 10000,
): Promise<void> {
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
