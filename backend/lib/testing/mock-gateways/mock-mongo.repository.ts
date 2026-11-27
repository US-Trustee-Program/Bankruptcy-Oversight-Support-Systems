import {
  activeKeyFor,
  inactiveKeyFor,
  RoleAssignmentAuditEntry,
  UserRoleAssignment,
} from '@common/cams/user-access';
import { RoleAssignmentAuditSearchPredicate } from '@common/api/search';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SyncedCase } from '@common/cams/cases';
import { TransferFrom, TransferTo, ConsolidationTo, ConsolidationFrom } from '@common/cams/events';
import { CaseHistory } from '@common/cams/history';
import { CamsUserReference, UserGroup } from '@common/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  ArchivedCasesRepository,
  BanksRepository,
  BankruptcySoftwareRepository,
  CamsPaginationResponse,
  CaseAssignmentRepository,
  CasesRepository,
  ConsolidationOrdersRepository,
  EmailNotificationArchiveRecord,
  EmailNotificationArchiveRepository,
  ListsRepository,
  TrusteeDataReportRepository,
  TrusteeDataReportRunState,
  NotificationRoutingRepository,
  OfficeAssigneesRepository,
  OfficesRepository,
  OrdersRepository,
  RuntimeState,
  RuntimeStateRepository,
  TrusteeAppointmentsRepository,
  TrusteeMatchVerificationRepository,
  TrusteeAppointmentVerificationRepository,
  TrusteeNotesRepository,
  TrusteesRepository,
  TrusteeStaffRepository,
  TrusteeUpcomingKeyDatesRepository,
  TrusteeProfessionalIdsRepository,
  TrusteeVariationRepository,
  SurrogateAppointment,
  UpdateResult,
  RoleAssignmentAuditRepository,
  UserGroupsRepository,
  UserRoleAssignmentRepository,
  UserSessionCacheRepository,
  UsersRepository,
} from '../../use-cases/gateways.types';
import { NotFoundError } from '../../common-errors/not-found-error';

const TRUSTEE_DATA_REPORT_LOCK = 'TRUSTEE_DATA_REPORT_RUN';
import {
  AppointmentStatus,
  Trustee,
  TrusteeHistory,
  TrusteeSummary,
  ZoomInfo,
} from '@common/cams/trustees';
import { TrusteeNote } from '@common/cams/trustee-notes';
import {
  TrusteeDataDifference,
  TrusteeDataReportRun,
  TrusteeDataReportSummary,
  StoredTrusteeDataReportSummary,
} from '@common/cams/trustee-data-report';
import {
  MOCK_CAMS_APPOINTMENTS_FOR_MOCK_TOD,
  MOCK_TRUSTEES_LINKED_TO_MOCK_TOD,
} from './mock-trustee-data-report.fixtures';
import {
  CaseAppointment,
  TrusteeAppointment,
  TrusteeCaseListItem,
} from '@common/cams/trustee-appointments';
import { TrusteeProfessionalId } from '../../use-cases/dataflows/trustee-professional-ids.types';
import { TrusteeVariation } from '@common/cams/trustee-variation';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { BankList, BankListItem, BankruptcySoftwareList } from '@common/cams/lists';
import { BankAuditHistory, BankProfile } from '@common/cams/banks';
import {
  BankruptcySoftwareAuditHistory,
  BankruptcySoftwareProfile,
} from '@common/cams/bankruptcy-software';
import { Creatable } from '@common/cams/creatable';
import {
  NotificationConfig,
  NotificationRecipient,
  NotificationRoutingRecord,
  NotificationRoutingUpdateInput,
  NOTIFICATION_ROUTING_DEFINITIONS,
} from '@common/cams/notifications';

export class MockMongoRepository
  implements
    ArchivedCasesRepository,
    BanksRepository,
    BankruptcySoftwareRepository,
    CaseAssignmentRepository,
    CasesRepository,
    ConsolidationOrdersRepository,
    OrdersRepository,
    OfficesRepository,
    RuntimeStateRepository,
    UsersRepository,
    UserSessionCacheRepository,
    OfficeAssigneesRepository,
    TrusteesRepository,
    TrusteeAppointmentsRepository,
    TrusteeStaffRepository,
    TrusteeMatchVerificationRepository,
    TrusteeAppointmentVerificationRepository,
    TrusteeVariationRepository,
    TrusteeNotesRepository,
    TrusteeProfessionalIdsRepository,
    TrusteeUpcomingKeyDatesRepository,
    ListsRepository,
    NotificationRoutingRepository,
    EmailNotificationArchiveRepository,
    TrusteeDataReportRepository,
    UserGroupsRepository,
    UserRoleAssignmentRepository,
    RoleAssignmentAuditRepository
{
  private professionalIds = new Map<string, TrusteeProfessionalId>();
  private trusteeVariations: TrusteeVariation[] = [];
  private notificationRouting = new Map<string, NotificationRoutingRecord>();
  private emailNotificationArchive = new Map<string, EmailNotificationArchiveRecord>();
  // Static: the factory makes a new mock per call, and a local (dbMock) report run spans many
  // queue messages, so its runs, rows and lock must outlive any one instance.
  private static trusteeDataReportRuns = new Map<string, TrusteeDataReportRun>();
  private static trusteeDataReportDifferences: (TrusteeDataDifference & {
    runId: string;
    pageKey: string;
  })[] = [];
  private static trusteeDataReportPages: {
    runId: string;
    pageKey: string;
    summary: TrusteeDataReportSummary;
  }[] = [];
  private static trusteeDataReportLock: TrusteeDataReportRunState | null = null;
  // Role assignments granted while DATABASE_MOCK=true, kept for the life of the process.
  private static roleAssignments: UserRoleAssignment[] = [];
  // Role assignment audit records written while DATABASE_MOCK=true, kept for the life of the process.
  private static roleAssignmentAudits: RoleAssignmentAuditEntry[] = [];
  private notificationConfig: NotificationConfig = { enabled: true };
  private runtimeStateCounters = new Map<string, number>();

  // Collapses the real two-phase seed+decrement into a single call.
  // Returns initialValue - 1 on first use to match the first value the real
  // implementation produces after seeding at initialValue then decrementing.
  async atomicDecrement(
    documentType: string,
    field: string,
    initialValue: number,
  ): Promise<number> {
    const key = `${documentType}:${field}`;
    const current = this.runtimeStateCounters.get(key) ?? initialValue;
    const next = current - 1;
    this.runtimeStateCounters.set(key, next);
    return next;
  }

  async atomicIncrement(documentType: string, field: string, amount: number = 1): Promise<number> {
    const key = `${documentType}:${field}`;
    const current = this.runtimeStateCounters.get(key) ?? 0;
    const next = current + amount;
    this.runtimeStateCounters.set(key, next);
    return next;
  }

  async setField(..._ignore: any[]): Promise<void> {
    return;
  }

  release() {
    return;
  }

  static getInstance(_context: ApplicationContext) {
    return new MockMongoRepository();
  }

  getBanks(): Promise<BankProfile[]> {
    throw new Error('Method not implemented.');
  }

  getBank(_id: string): Promise<BankProfile> {
    throw new Error('Method not implemented.');
  }

  findBankByName(_normalizedName: string): Promise<BankProfile | null> {
    throw new Error('Method not implemented.');
  }

  createBank(_bank: Creatable<BankProfile>): Promise<BankProfile> {
    throw new Error('Method not implemented.');
  }

  updateBank(_id: string, _bank: BankProfile): Promise<BankProfile> {
    throw new Error('Method not implemented.');
  }

  createBankAuditRecord(_history: Creatable<BankAuditHistory>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getBankHistory(_bankId: string): Promise<BankAuditHistory[]> {
    throw new Error('Method not implemented.');
  }

  getSoftwareList(): Promise<BankruptcySoftwareProfile[]> {
    throw new Error('Method not implemented.');
  }

  createSoftware(
    _software: Creatable<BankruptcySoftwareProfile>,
  ): Promise<BankruptcySoftwareProfile> {
    throw new Error('Method not implemented.');
  }

  findSoftwareById(_id: string): Promise<BankruptcySoftwareProfile> {
    throw new Error('Method not implemented.');
  }

  findSoftwareByBankId(_bankId: string): Promise<BankruptcySoftwareProfile[]> {
    throw new Error('Method not implemented.');
  }

  updateSoftware(
    _id: string,
    _update: BankruptcySoftwareProfile,
  ): Promise<BankruptcySoftwareProfile> {
    throw new Error('Method not implemented.');
  }

  createSoftwareAuditRecord(_history: Creatable<BankruptcySoftwareAuditHistory>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getSoftwareHistory(_softwareId: string): Promise<BankruptcySoftwareAuditHistory[]> {
    throw new Error('Method not implemented.');
  }

  getAssignmentsForCases(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  findAssignmentsByAssignee(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  findAndDeleteStaff(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getOfficeAttorneys(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  putOrExtendOfficeStaff(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  putOfficeStaff(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getState<T extends RuntimeState>(..._ignore): Promise<T> {
    throw new Error('Method not implemented.');
  }

  updateState(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  createState<T extends RuntimeState>(..._ignore): Promise<T> {
    throw new Error('Method not implemented.');
  }

  createTransferFrom(..._ignore): Promise<TransferFrom> {
    throw new Error('Method not implemented.');
  }

  createTransferTo(..._ignore): Promise<TransferTo> {
    throw new Error('Method not implemented.');
  }

  createConsolidationTo(..._ignore): Promise<ConsolidationTo> {
    throw new Error('Method not implemented.');
  }

  createConsolidationFrom(..._ignore): Promise<ConsolidationFrom> {
    throw new Error('Method not implemented.');
  }

  getConsolidation(..._ignore): Promise<Array<ConsolidationTo | ConsolidationFrom>> {
    throw new Error('Method not implemented.');
  }

  getCaseHistory(..._ignore): Promise<CaseHistory[]> {
    throw new Error('Method not implemented.');
  }

  getAllCaseHistory(..._ignore): Promise<CaseHistory[]> {
    throw new Error('Method not implemented.');
  }

  createCaseHistory(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateCaseHistory(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  syncDxtrCase(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  update(..._ignore): Promise<any | void> {
    throw new Error('Method not implemented.');
  }

  updateOne(..._ignore): Promise<UpdateResult> {
    throw new Error('Method not implemented.');
  }

  upsert(...args): Promise<any | void> {
    if (args[0]?.documentType === TRUSTEE_DATA_REPORT_LOCK) {
      MockMongoRepository.trusteeDataReportLock = args[0];
      return Promise.resolve(args[0]);
    }
    throw new Error('Method not implemented.');
  }

  search(...args): Promise<any> {
    const predicate = args[0];
    if (typeof predicate?.offset === 'number' && typeof predicate?.limit === 'number') {
      return this.searchRoleAssignmentAudits(predicate as RoleAssignmentAuditSearchPredicate);
    }
    throw new Error('Method not implemented.');
  }

  /**
   * Mirrors RoleAssignmentAuditMongoRepository.search's sort: performedAt descending, then
   * DEACTIVATED before CREATED, then id descending.
   */
  private searchRoleAssignmentAudits(
    predicate: RoleAssignmentAuditSearchPredicate,
  ): Promise<CamsPaginationResponse<RoleAssignmentAuditEntry>> {
    if (predicate.userIds && predicate.userIds.length === 0) {
      return Promise.resolve({ metadata: { total: 0 }, data: [] });
    }
    const filtered = predicate.userIds
      ? MockMongoRepository.roleAssignmentAudits.filter((entry) =>
          predicate.userIds!.includes(entry.userId),
        )
      : MockMongoRepository.roleAssignmentAudits;
    const sorted = [...filtered].sort((a, b) => {
      if (a.performedAt !== b.performedAt) return a.performedAt > b.performedAt ? -1 : 1;
      if (a.action !== b.action) return a.action > b.action ? -1 : 1;
      return a.id > b.id ? -1 : 1;
    });
    const data = sorted.slice(predicate.offset, predicate.offset + predicate.limit);
    return Promise.resolve({ metadata: { total: sorted.length }, data });
  }

  searchPaginated(..._ignore): Promise<CamsPaginationResponse<any>> {
    throw new Error('Method not implemented.');
  }

  searchCases(..._ignore): Promise<CamsPaginationResponse<SyncedCase>> {
    throw new Error('Method not implemented.');
  }

  searchCasesWithPhoneticTokens(..._ignore): Promise<CamsPaginationResponse<SyncedCase>> {
    throw new Error('Method not implemented.');
  }

  findActiveByUserIds(userIds: string[]): Promise<UserRoleAssignment[]> {
    return Promise.resolve(
      MockMongoRepository.roleAssignments.filter((a) => a.active && userIds.includes(a.userId)),
    );
  }

  findByIds(refs: Pick<UserRoleAssignment, 'userId' | 'id'>[]): Promise<UserRoleAssignment[]> {
    return Promise.resolve(
      MockMongoRepository.roleAssignments.filter((a) =>
        refs.some((ref) => ref.userId === a.userId && ref.id === a.id),
      ),
    );
  }

  findActiveByUserAndRole(userId: string, role: string): Promise<UserRoleAssignment[]> {
    return Promise.resolve(
      MockMongoRepository.roleAssignments.filter(
        (a) => a.active && a.userId === userId && a.role === role,
      ),
    );
  }

  // Like the Mongo repository: a compare-and-set on active, addressed by userId and id.
  deactivate(
    assignment: Pick<UserRoleAssignment, 'userId' | 'id'>,
  ): Promise<UserRoleAssignment | null> {
    const held = MockMongoRepository.roleAssignments.find(
      (a) => a.active && a.userId === assignment.userId && a.id === assignment.id,
    );
    if (!held) return Promise.resolve(null);
    const deactivated = { ...held, active: false, activeKey: inactiveKeyFor(held.id) };
    MockMongoRepository.roleAssignments = MockMongoRepository.roleAssignments.map((a) =>
      a === held ? deactivated : a,
    );
    return Promise.resolve(deactivated);
  }

  // Like the Mongo repository: a compare-and-set on inactive, addressed by userId and id.
  reactivate(
    assignment: Pick<UserRoleAssignment, 'userId' | 'id' | 'role' | 'regionId' | 'officeCode'>,
  ): Promise<UserRoleAssignment | null> {
    const removed = MockMongoRepository.roleAssignments.find(
      (a) => !a.active && a.userId === assignment.userId && a.id === assignment.id,
    );
    if (!removed) return Promise.resolve(null);
    const restored = {
      ...removed,
      active: true,
      activeKey: activeKeyFor(removed.role, removed.regionId, removed.officeCode),
    };
    MockMongoRepository.roleAssignments = MockMongoRepository.roleAssignments.map((a) =>
      a === removed ? restored : a,
    );
    return Promise.resolve(restored);
  }

  countActiveByRole(role: string): Promise<number> {
    return Promise.resolve(
      MockMongoRepository.roleAssignments.filter((a) => a.active && a.role === role).length,
    );
  }

  deleteByUserId(_userId: string): Promise<void> {
    return Promise.resolve();
  }

  create(...args): Promise<any> {
    const item = args[0];
    if (item?.documentType === 'USER_ROLE_ASSIGNMENT') {
      // Mirrors the unique {userId, activeKey} index: a duplicate returns null.
      const assignment = item as UserRoleAssignment;
      const duplicate = MockMongoRepository.roleAssignments.some(
        (a) => a.userId === assignment.userId && a.activeKey === assignment.activeKey,
      );
      if (duplicate) return Promise.resolve(null);
      MockMongoRepository.roleAssignments.push(assignment);
      return Promise.resolve(assignment);
    }
    if (item?.documentType === 'ROLE_ASSIGNMENT_AUDIT') {
      MockMongoRepository.roleAssignmentAudits.push(item as RoleAssignmentAuditEntry);
      return Promise.resolve();
    }
    throw new Error('Method not implemented.');
  }

  createMany(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  read(...args): Promise<any> {
    if (args[0] === TRUSTEE_DATA_REPORT_LOCK) {
      const lock = MockMongoRepository.trusteeDataReportLock;
      return lock
        ? Promise.resolve(lock)
        : Promise.reject(new NotFoundError('MOCK-MONGO-REPOSITORY'));
    }
    throw new Error('Method not implemented.');
  }

  readStaffMember(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  delete(...args): Promise<void> {
    if (args[0] === TRUSTEE_DATA_REPORT_LOCK) {
      MockMongoRepository.trusteeDataReportLock = null;
      return Promise.resolve();
    }
    throw new Error('Method not implemented.');
  }

  getNotesByCaseId(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  archiveCaseNote(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getNotesSince(..._ignore): Promise<TrusteeNote[]> {
    throw new Error('Method not implemented.');
  }

  getNotesByTrusteeId(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  archiveTrusteeNote(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async getTransfers(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  putPrivilegedIdentityUser(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getPrivilegedIdentityUser(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  deletePrivilegedIdentityUser(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getConsolidationMemberCaseIds(..._ignore): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  getAllActiveAssignments(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  getSyncedCase(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getCaseOrMovedCase(..._ignore: any[]): Promise<any> {
    return Promise.resolve(null);
  }

  updateManyByQuery(..._ignore): Promise<UpdateResult> {
    throw new Error('Method not implemented.');
  }

  findByCursor(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  findActiveMissingAppointedDate(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  findClosedAppointments(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  findSentinelAppointments(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  findTransferOrdersMissingTaskDate(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  updateTransferOrderTaskDate(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  findConsolidationOrdersMissingTaskDate(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  updateConsolidationOrderTaskDate(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  findVerificationsMissingTaskDate(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  updateVerificationTaskDate(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getAllCaseAppointments(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  updateCaseFields(..._ignore: any[]): Promise<void> {
    return Promise.resolve(undefined);
  }

  getActiveByTrusteeIdFromTrusteePartition(..._ignore: any[]): Promise<CaseAppointment[]> {
    return Promise.resolve([]);
  }

  getSurrogatesByFingerprint(..._ignore: any[]): Promise<SurrogateAppointment[]> {
    return Promise.resolve([]);
  }

  getSurrogatesByFingerprints(..._ignore: any[]): Promise<SurrogateAppointment[]> {
    return Promise.resolve([]);
  }

  findParkedFiledOnOrAfter(..._ignore: any[]): Promise<any[]> {
    return Promise.resolve([]);
  }

  countParkedFiledOn(..._ignore: any[]): Promise<number> {
    return Promise.resolve(0);
  }
  findAppointmentIdPairsByChapter(
    ..._ignore: any[]
  ): Promise<Array<{ trusteeApptId: string; caseApptId: string | null }>> {
    throw new Error('Method not implemented.');
  }

  applyChapterFix(..._ignore: any[]): Promise<{ modifiedCount: number }> {
    throw new Error('Method not implemented.');
  }

  getCaseIdsRemainingToSync(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  deleteMany(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getDistinctAssigneesByOffice(_ignore: any): Promise<CamsUserReference[]> {
    throw new Error('Method not implemented.');
  }

  count(_ignore: any): Promise<number> {
    throw new Error('Method not implemented.');
  }

  createTrustee(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateTrustee(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  listTrustees(): Promise<any[]> {
    return Promise.resolve(MOCK_TRUSTEES_LINKED_TO_MOCK_TOD);
  }

  findTrusteesByName(_name: string): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  findTrusteesByIds(_trusteeIds: string[]): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  searchTrusteesByName(_name: string): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  searchTrusteesByPhoneticTokens(_tokens: string[]): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  searchTrusteesByNameScored(_name: string): Promise<any[]> {
    return Promise.resolve([]);
  }

  findTrusteesBySoftware(
    _softwareId: string,
    _limit: number,
    _offset: number,
  ): Promise<CamsPaginationResponse<TrusteeSummary>> {
    throw new Error('Method not implemented.');
  }

  findTrusteesByBank(
    _bankId: string,
    _limit: number,
    _offset: number,
  ): Promise<CamsPaginationResponse<TrusteeSummary>> {
    throw new Error('Method not implemented.');
  }

  findTrusteesByBankAndSoftware(
    _softwareId: string,
    _bankId: string,
    _limit: number,
    _offset: number,
  ): Promise<CamsPaginationResponse<TrusteeSummary>> {
    throw new Error('Method not implemented.');
  }

  countTrusteesByBankAndSoftware(_softwareId: string, _bankId: string): Promise<number> {
    throw new Error('Method not implemented.');
  }

  setPhoneticTokens(_trusteeId: string, _tokens: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setZoomInfo(_trusteeId: string, _zoomInfo: ZoomInfo): Promise<void> {
    throw new Error('Method not implemented.');
  }

  createTrusteeHistory(_ignore: TrusteeHistory): Promise<void> {
    throw new Error('Method not implemented.');
  }

  listTrusteeHistory(_ignore: string): Promise<TrusteeHistory[]> {
    throw new Error('Method not implemented.');
  }

  getBankruptcySoftwareList(): Promise<BankruptcySoftwareList> {
    throw new Error('Method not implemented.');
  }

  getBankList(): Promise<BankList> {
    throw new Error('Method not implemented.');
  }

  postBank(_ignore: Creatable<BankListItem>): Promise<string> {
    throw new Error('Method not implemented.');
  }

  deleteBank(_ignore: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getTrusteeOversightAssignments(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  createTrusteeOversightAssignment(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateTrusteeOversightAssignment(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  upsertUserGroupsBatch(_ignore: any): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async getUserGroupsByNames(..._ignore): Promise<UserGroup[]> {
    throw new Error('Method not implemented.');
  }

  getTrusteeAppointments(_ignore: any): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  /** The appointments of the trustee data report's mock CAMS trustees. */
  async getAppointmentsByTrusteeIds(trusteeIds: string[]): Promise<TrusteeAppointment[]> {
    return MOCK_CAMS_APPOINTMENTS_FOR_MOCK_TOD.filter((appointment) =>
      trusteeIds.includes(appointment.trusteeId),
    );
  }

  getTrusteeIdsByStatuses(_statuses: AppointmentStatus[]): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  getChapter7DueDateMetricsAggregation(): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getTrusteeStaff(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  createStaffMember(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateStaffMember(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  deleteStaffMember(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  createAppointment(..._ignore: any[]): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateAppointment(
    _trusteeId: string,
    _appointmentId: string,
    _appointmentInput: any,
    _userRef: any,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getActiveCaseAppointmentsByTrusteeId(_trusteeId: string): Promise<CaseAppointment[]> {
    return Promise.resolve([]);
  }

  createCaseAppointment(..._ignore: any[]): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateCaseAppointment(..._ignore: any[]): Promise<any> {
    throw new Error('Method not implemented.');
  }

  // TrusteeCaseAppointmentsRepository methods
  getByCaseId(..._ignore: any[]): Promise<CaseAppointment[]> {
    return Promise.resolve([]);
  }

  getActiveByCaseId(..._ignore: any[]): Promise<any> {
    return Promise.resolve(null);
  }

  getCasesForTrustee(..._ignore: any[]): Promise<CamsPaginationResponse<TrusteeCaseListItem>> {
    return Promise.resolve({ data: [], metadata: { total: 0 } });
  }

  getDistinctDivisionsForTrustee(..._ignore: any[]): Promise<string[]> {
    return Promise.resolve([]);
  }

  findTrusteeByLegacyTruId(_ignore: any): Promise<Trustee | null> {
    throw new Error('Method not implemented.');
  }

  findTrusteesByLegacyTruIds(truIds: string[]): Promise<Trustee[]> {
    return Promise.resolve(
      MOCK_TRUSTEES_LINKED_TO_MOCK_TOD.filter((trustee) =>
        (trustee.legacy?.truIds ?? []).some((id) => truIds.includes(id)),
      ),
    );
  }

  findTrusteeByNameAndState(..._ignore): Promise<Trustee | null> {
    throw new Error('Method not implemented.');
  }

  deleteSyncedCases(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  findDuplicateSyncedCases(): Promise<
    Array<{ dxtrId: string; courtId: string; caseIds: string[] }>
  > {
    throw new Error('Method not implemented.');
  }

  findSyncedCaseByDxtrId(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  findByCaseId(..._ignore): Promise<any[]> {
    return Promise.resolve([]);
  }

  findByCaseIdAndType(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  archiveDocument(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getCaseArchives(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  getVerification(..._ignore: any[]): Promise<any> {
    throw new Error('Method not implemented.');
  }

  findById(..._ignore: any[]): Promise<any> {
    throw new Error('Method not implemented.');
  }

  upsertVerification(..._ignore: any[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateIfPending(..._ignore: any[]): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  getByAppointmentId(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  createHistory(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  upsertProfessionalId(
    document: Omit<
      TrusteeProfessionalId,
      'id' | 'createdOn' | 'createdBy' | 'updatedOn' | 'updatedBy'
    >,
    user: CamsUserReference,
  ): Promise<TrusteeProfessionalId> {
    const key = `${document.camsTrusteeId}:${document.acmsProfessionalId}`;
    const existing = this.professionalIds.get(key);
    const mapping: TrusteeProfessionalId = {
      ...document,
      id: existing?.id ?? crypto.randomUUID(),
      createdOn: existing?.createdOn ?? new Date().toISOString(),
      createdBy: existing?.createdBy ?? user,
      updatedBy: user,
      updatedOn: new Date().toISOString(),
    };
    this.professionalIds.set(key, mapping);
    return Promise.resolve(mapping);
  }

  findAll(): Promise<TrusteeProfessionalId[]> {
    return Promise.resolve([]);
  }

  findByCamsTrusteeId(camsTrusteeId: string): Promise<TrusteeProfessionalId[]> {
    return Promise.resolve(
      Array.from(this.professionalIds.values()).filter(
        (m) => m.camsTrusteeId === camsTrusteeId && m.disposition === 'linked',
      ),
    );
  }

  findByAcmsProfessionalId(acmsProfessionalId: string): Promise<TrusteeProfessionalId[]> {
    return Promise.resolve(
      Array.from(this.professionalIds.values()).filter(
        (m) => m.acmsProfessionalId === acmsProfessionalId && m.disposition === 'linked',
      ),
    );
  }

  hasConflictByAcmsProfessionalId(acmsProfessionalId: string): Promise<boolean> {
    return Promise.resolve(
      Array.from(this.professionalIds.values()).some(
        (m) => m.acmsProfessionalId === acmsProfessionalId && m.disposition === 'conflict',
      ),
    );
  }

  findUnresolvedByFingerprint(fingerprint: string): Promise<TrusteeProfessionalId[]> {
    return Promise.resolve(
      Array.from(this.professionalIds.values()).filter(
        (m) =>
          m.camsTrusteeId === fingerprint &&
          (m.disposition === 'no-match' || m.disposition === 'ambiguous'),
      ),
    );
  }

  deleteLink(camsTrusteeId: string, acmsProfessionalId: string): Promise<number> {
    const deleted = this.professionalIds.delete(`${camsTrusteeId}:${acmsProfessionalId}`);
    return Promise.resolve(deleted ? 1 : 0);
  }

  deleteAllBySource(..._ignore: any[]): Promise<{ deletedCount: number }> {
    throw new Error('Method not implemented.');
  }

  deleteAll(): Promise<number> {
    const count = this.professionalIds.size;
    this.professionalIds.clear();
    return Promise.resolve(count);
  }

  deleteCaseAppointments(..._ignore: any[]): Promise<number> {
    return Promise.resolve(0);
  }

  markAsMoved(..._ignore: any[]): Promise<void> {
    return Promise.resolve();
  }

  // ── TrusteeVariationRepository / TrusteeMatchVerificationRepository ──────
  // Both interfaces declare findByFingerprint with different return types; overloaded here to
  // satisfy both. Only the TrusteeVariationRepository behavior is backed by real state — tests
  // needing TrusteeMatchVerificationRepository's findByFingerprint spy over
  // MockMongoRepository.prototype, same as getVerification/upsertVerification/findById above.
  findByFingerprint(fingerprint: string): Promise<TrusteeVariation[]>;
  findByFingerprint(fingerprint: string): Promise<TrusteeMatchVerification[]>;
  findByFingerprint(
    fingerprint: string,
  ): Promise<TrusteeVariation[]> | Promise<TrusteeMatchVerification[]> {
    return Promise.resolve(this.trusteeVariations.filter((v) => v.fingerprint === fingerprint));
  }

  createVariation(item: Creatable<TrusteeVariation>): Promise<TrusteeVariation> {
    const created: TrusteeVariation = { id: crypto.randomUUID(), ...item };
    this.trusteeVariations.push(created);
    return Promise.resolve(created);
  }

  // ── TrusteeAppointmentVerificationRepository ──────────────────────────────
  openOrJoin(..._ignore: any[]): Promise<void> {
    return Promise.resolve();
  }

  resolve(..._ignore: any[]): Promise<boolean> {
    return Promise.resolve(true);
  }

  markTrusteeAppointmentMatched(..._ignore: any[]): Promise<boolean> {
    return Promise.resolve(true);
  }

  // ── NotificationRoutingRepository ─────────────────────────────────────────
  async findRecipientsByRoutingKeys(keys: string[]): Promise<NotificationRecipient[]> {
    return Array.from(this.notificationRouting.values()).filter((record) =>
      record.covers.some((covered) => keys.includes(covered)),
    );
  }

  async getAll(): Promise<NotificationRoutingRecord[]> {
    return Array.from(this.notificationRouting.values());
  }

  async updateRoutingRecord(
    id: string,
    input: NotificationRoutingUpdateInput,
  ): Promise<NotificationRoutingRecord> {
    const existing = this.notificationRouting.get(id);
    if (!existing) {
      const def = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === id);
      const record: NotificationRoutingRecord = {
        id,
        documentType: 'NOTIFICATION_ROUTING',
        covers: def?.covers ?? [],
        displayName: def?.displayName ?? '',
        recipientAddresses: input.recipientAddresses,
      };
      this.notificationRouting.set(id, record);
      return record;
    }
    const updated = { ...existing, recipientAddresses: input.recipientAddresses };
    this.notificationRouting.set(id, updated);
    return updated;
  }

  async createRoutingAuditRecord(): Promise<void> {
    // no-op in mock
  }

  async getConfig(): Promise<NotificationConfig> {
    return this.notificationConfig;
  }

  async updateConfig(config: NotificationConfig): Promise<NotificationConfig> {
    this.notificationConfig = config;
    return this.notificationConfig;
  }

  /** Test-only. Clears all seeded notification routing rows. */
  clearNotificationRouting(): void {
    this.notificationRouting.clear();
  }

  /** Test-only seed helper. Bulk-loads routing rows into the in-memory map. */
  seedNotificationRouting(rows: NotificationRoutingRecord[]): void {
    for (const row of rows) {
      this.notificationRouting.set(row.id, row);
    }
  }

  // Mock implementation for existsInTrusteePartition
  async existsInTrusteePartition(
    ..._args: [caseId: string, trusteeId: string, assignedOn: string]
  ): Promise<boolean> {
    return true; // Mock defaults to "already in sync" — test spies will override
  }

  // Mock implementation for findStrandedActiveInTrusteePartition
  async findStrandedActiveInTrusteePartition(
    ..._args: [caseId: string, excludeTrusteeId: string]
  ): Promise<CaseAppointment | null> {
    return null; // Mock defaults to "nothing stranded" — test spies will override
  }

  // ── EmailNotificationArchiveRepository ────────────────────────────────────
  async archiveSentEmail(record: EmailNotificationArchiveRecord): Promise<void> {
    this.emailNotificationArchive.set(record.messageId, record);
  }

  async readArchivedEmail(messageId: string): Promise<EmailNotificationArchiveRecord | null> {
    return this.emailNotificationArchive.get(messageId) ?? null;
  }

  // ── TrusteeDataReportRepository ───────────────────────────────────────────
  async upsertRun(run: TrusteeDataReportRun): Promise<void> {
    MockMongoRepository.trusteeDataReportRuns.set(run.runId, run);
  }

  async readRun(runId: string): Promise<TrusteeDataReportRun | null> {
    return MockMongoRepository.trusteeDataReportRuns.get(runId) ?? null;
  }

  async readLatestCompletedRun(): Promise<TrusteeDataReportRun | null> {
    return this.readLatestTrusteeDataReportRun('completed');
  }

  async readLatestFailedRun(): Promise<TrusteeDataReportRun | null> {
    return this.readLatestTrusteeDataReportRun('failed');
  }

  async listCompletedRunIds(): Promise<string[]> {
    return [...MockMongoRepository.trusteeDataReportRuns.values()]
      .filter((run) => run.status === 'completed')
      .map((run) => run.runId);
  }

  private readLatestTrusteeDataReportRun(
    status: TrusteeDataReportRun['status'],
  ): TrusteeDataReportRun | null {
    const runs = [...MockMongoRepository.trusteeDataReportRuns.values()]
      .filter((run) => run.status === status)
      .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
    return runs[0] ?? null;
  }

  async replacePageResults(
    runId: string,
    pageKey: string,
    differences: TrusteeDataDifference[],
    summary: TrusteeDataReportSummary,
  ): Promise<void> {
    const otherPage = (doc: { runId: string; pageKey: string }) =>
      doc.runId !== runId || doc.pageKey !== pageKey;
    MockMongoRepository.trusteeDataReportDifferences = [
      ...MockMongoRepository.trusteeDataReportDifferences.filter(otherPage),
      ...differences.map((d) => ({ ...d, runId, pageKey })),
    ];
    MockMongoRepository.trusteeDataReportPages = [
      ...MockMongoRepository.trusteeDataReportPages.filter(otherPage),
      { runId, pageKey, summary },
    ];
  }

  async readPageSummaries(runId: string): Promise<StoredTrusteeDataReportSummary[]> {
    return MockMongoRepository.trusteeDataReportPages
      .filter((page) => page.runId === runId)
      .map((page) => page.summary);
  }

  async deleteRunResults(runId: string): Promise<void> {
    MockMongoRepository.trusteeDataReportDifferences =
      MockMongoRepository.trusteeDataReportDifferences.filter((d) => d.runId !== runId);
    MockMongoRepository.trusteeDataReportPages = MockMongoRepository.trusteeDataReportPages.filter(
      (page) => page.runId !== runId,
    );
  }

  async deleteRun(runId: string): Promise<void> {
    MockMongoRepository.trusteeDataReportRuns.delete(runId);
    await this.deleteRunResults(runId);
  }

  // Mock implementation for replaceOneInTrusteePartition
  async replaceOneInTrusteePartition(_query: any, _document: any): Promise<void> {
    // Mock does nothing — test spies will override
  }

  // Mock implementation for replaceOneInCasePartition
  async replaceOneInCasePartition(_query: any, _document: any): Promise<void> {
    // Mock does nothing — test spies will override
  }
}
