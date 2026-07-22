import { ApplicationContext } from '../adapters/types/basic';
import { LoggerImpl } from '../adapters/services/logger.service';
import { AtsTrusteeRecord, TrusteeAppointmentsResult } from '../adapters/types/ats.types';
import { DbTableFieldSpec, QueryResults } from '../adapters/types/database';
import {
  ConsolidationOrder,
  Order,
  OrderStatus,
  RawOrderSync,
  TransferOrder,
  TransferOrderAction,
} from '@common/cams/orders';
import { ConsolidationTo, ConsolidationFrom, TransferFrom, TransferTo } from '@common/cams/events';
import { CaseHistory } from '@common/cams/history';
import { CaseDocket, CaseNote, SyncedCase } from '@common/cams/cases';
import {
  CasesSearchPredicate,
  OfficeAssigneePredicate,
  OfficeUserRolesPredicate,
  OrdersSearchPredicate,
  TrusteeCasesSearchPredicate,
} from '@common/api/search';
import {
  AttorneyUser,
  PrivilegedIdentityUser,
  CamsUserGroup,
  CamsUserReference,
  Staff,
  UserGroup,
} from '@common/cams/users';
import { UstpOfficeDetails } from '@common/cams/offices';
import { CaseAssignment } from '@common/cams/assignments';
import {
  CaseAssignmentDownstreamEvent,
  TrusteeAppointmentDownstreamEvent,
} from '@common/cams/dataflow-events';
import { CamsSession } from '@common/cams/session';
import { ConditionOrConjunction, Projection, Query, SortSpec } from '../query/query-builder';
import { AcmsConsolidation, AcmsPredicate } from './dataflows/migrate-consolidations';
import { Pipeline } from '../query/query-pipeline';
import { ResourceActions } from '@common/cams/actions';
import { OfficeStaff } from '../adapters/gateways/mongo/offices.mongo.repository';
import {
  AppointmentStatus,
  Trustee,
  TrusteeHistory,
  TrusteeInput,
  TrusteeOversightAssignment,
  TrusteeSummary,
} from '@common/cams/trustees';
import { TrusteeNote } from '@common/cams/trustee-notes';
import {
  CaseAppointment,
  CaseAppointmentInput,
  CaseDenormalizedFields,
  TrusteeAppointment,
  TrusteeAppointmentInput,
  TrusteeCaseListItem,
} from '@common/cams/trustee-appointments';
import {
  TrusteeMatchVerification,
  TrusteeMatchVerificationSearchResult,
} from '@common/cams/trustee-match-verification';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesHistory,
} from '@common/cams/trustee-upcoming-key-dates';
import { TrusteeStaff, TrusteeStaffInput } from '@common/cams/trustee-staff';
import { Auditable } from '@common/cams/auditable';
import { BankList, BankListItem, BankruptcySoftwareList } from '@common/cams/lists';
import { Creatable } from '@common/cams/creatable';
import { Identifiable } from '@common/cams/document';
import { BankAuditHistory, BankProfile } from '@common/cams/banks';
import {
  BankruptcySoftwareAuditHistory,
  BankruptcySoftwareProfile,
} from '@common/cams/bankruptcy-software';
import { TrusteeProfessionalId } from '@common/cams/trustee-professional-ids';
import {
  Notification,
  NotificationRecipient,
  NotificationRoutingRecord,
  NotificationRoutingUpdateInput,
  NotificationRoutingAuditHistory,
} from '@common/cams/notifications';

export type ReplaceResult = {
  id: string;
  modifiedCount: number;
  upsertedCount: number;
};

export type UpdateResult = {
  modifiedCount: number;
  matchedCount: number;
};

export type BulkReplaceResult = {
  id?: string;
  insertedCount: number;
  matchedCount: number;
  modifiedCount: number;
  deletedCount: number;
  upsertedCount: number;
  upsertedIds: Record<string, unknown>;
  insertedIds: Record<string, unknown>;
};

export interface Releasable {
  release: () => void;
}

interface Creates<T, R = void> {
  create(data: T): Promise<R>;
}

interface CreatesMany<T, R = void> {
  createMany(data: T[]): Promise<R>;
}

interface Reads<R> {
  read(id: string, key?: string): Promise<R>;
}

interface Updates<T, R = void> {
  update(data: T): Promise<R>;
}

interface Upserts<T, R = void> {
  upsert(data: T): Promise<R>;
}

interface Deletes {
  delete(id: string): Promise<void>;
}

interface DeletesMany<T> {
  deleteMany(predicate: T): Promise<void>;
}

interface Searches<P, R> {
  search(predicate?: P): Promise<R[]>;
}

export interface ConsolidationOrdersRepository<T = ConsolidationOrder>
  extends
    Searches<OrdersSearchPredicate, T>,
    Creates<T, T>,
    CreatesMany<T>,
    Reads<T>,
    Deletes,
    Updates<T, T>,
    Releasable {
  count: (keyRoot: string) => Promise<number>;
  updateManyByQuery: <U>(query: Query<U>, update: object) => Promise<UpdateResult>;
  findByCaseId(caseId: string): Promise<ConsolidationOrder[]>;
  findConsolidationOrdersMissingTaskDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<ConsolidationOrder & { _id: string }>>;
  updateConsolidationOrderTaskDate(mongoId: string, taskDate: string): Promise<void>;
}

export interface UserSessionCacheRepository<T = CamsSession>
  extends Reads<T>, Upserts<T, T>, Releasable {}

export interface CaseAssignmentRepository<T = CaseAssignment>
  extends Creates<T, string>, Updates<CaseAssignment, string>, Releasable {
  getAssignmentsForCases(caseIds: string[]): Promise<Map<string, CaseAssignment[]>>;
  findAssignmentsByAssignee(userId: string): Promise<CaseAssignment[]>;
  getAllActiveAssignments(): Promise<CaseAssignment[]>;
  findByCaseId(caseId: string): Promise<CaseAssignment[]>;
  delete(id: string): Promise<void>;
}

export interface CaseNotesRepository<T = CaseNote>
  extends Creates<T, T>, Updates<Partial<T>>, Reads<T> {
  getNotesByCaseId(caseId: string): Promise<CaseNote[]>;
  archiveCaseNote(archiveNote: Partial<CaseNote>): Promise<UpdateResult>;
}

export interface TrusteeNotesRepository<T = TrusteeNote>
  extends Creates<T, T>, Updates<Partial<T>>, Reads<T>, Releasable {
  getNotesSince(isoDate: string): Promise<TrusteeNote[]>;
  getNotesByTrusteeId(trusteeId: string): Promise<TrusteeNote[]>;
  archiveTrusteeNote(archiveNote: Partial<TrusteeNote>): Promise<UpdateResult>;
}

export interface OrdersRepository<T = Order>
  extends
    Searches<OrdersSearchPredicate, T>,
    Creates<T, T>,
    CreatesMany<T, T[]>,
    Reads<T>,
    Updates<TransferOrderAction>,
    Deletes,
    Releasable {
  findByCaseId(caseId: string): Promise<Order[]>;
  findTransferOrdersMissingTaskDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<TransferOrder & { _id: string }>>;
  updateTransferOrderTaskDate(mongoId: string, taskDate: string): Promise<void>;
  updateManyByQuery: <U>(query: Query<U>, update: object) => Promise<UpdateResult>;
}

export interface ArchivedCasesRepository extends Releasable {
  archiveDocument<T>(document: T, originalCollection: string, caseId: string): Promise<void>;
}

export interface RuntimeStateRepository<T extends RuntimeState = RuntimeState>
  extends Reads<T>, Upserts<T, T> {
  atomicDecrement(
    documentType: RuntimeStateDocumentType,
    field: keyof T & string,
    initialValue: number,
  ): Promise<number>;
  atomicIncrement(
    documentType: RuntimeStateDocumentType,
    field: keyof T & string,
    amount?: number,
  ): Promise<number>;
}

export interface CaseDocketGateway {
  getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket>;
}

export interface OrdersGateway {
  getOrderSync(context: ApplicationContext, txId: string): Promise<RawOrderSync>;
}

export type AcmsCaseAppointmentRecord = {
  id: number;
  caseId: string;
  acmsProfessionalId: string;
  assignDate: number;
  apptDate: number | null;
  unassignDate: number | null;
  // Case metadata from CMMDB/CMMKE — no Cosmos lookup required during migration
  caseFiledDate: number | null;
  chapter: string | null;
  courtDivisionCode: string;
  closedByCourtDate: number | null;
  closedByUstDate: number | null;
  reopenedDate: number | null;
};

export type AcmsCaseAppointmentRawRecord = {
  id: number;
  CASE_DIV: number;
  CASE_YEAR: number;
  CASE_NUMBER: number;
  GROUP_DESIGNATOR: string;
  PROF_CODE: number;
  APPT_DATE: number;
  DISP_DATE: number | null;
  // Case metadata from CMMDB/CMMKE joins
  CASE_FILED_DATE: number | null;
  CURR_CASE_CHAPT: string | null;
  CLOSED_BY_COURT_DATE: number | null;
  CLOSED_BY_UST_DATE: number | null;
  REOPENED_DATE: number | null;
};

/**
 * A single ACMS trustee professional record from CMMPR, keyed on the compound
 * `(GROUP_DESIGNATOR, PROF_CODE)` professional ID and carrying the name/state
 * fields needed to match the record back to a CAMS trustee. Used by the
 * inverse (ACMS → CAMS) professional-ID backfill pass.
 */
export type AcmsTrusteeProfessionalRecord = {
  acmsProfessionalId: string;
  firstName: string;
  lastName: string;
  state: string;
};

export function formatCaseId(div: number, year: number, num: number): string {
  return `${String(div).padStart(3, '0')}-${String(year).padStart(2, '0')}-${String(num).padStart(5, '0')}`;
}

export function formatAcmsProfessionalId(group: string, code: number): string {
  return `${group.trim()}-${String(code).padStart(5, '0')}`;
}

export interface AcmsGateway {
  getLeadCaseIds(context: ApplicationContext, predicateAndPage: AcmsPredicate): Promise<string[]>;
  getConsolidationDetails(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsConsolidation>;
  loadMigrationTable(context: ApplicationContext): Promise<void>;
  getMigrationCaseIds(context: ApplicationContext, start: number, end: number): Promise<string[]>;
  emptyMigrationTable(context: ApplicationContext): Promise<void>;
  getMigrationCaseCount(context: ApplicationContext): Promise<number>;
  getDeletedCaseIds(
    context: ApplicationContext,
    lastChangeDate: string,
  ): Promise<{ caseIds: string[]; latestDeletedCaseDate: string }>;
  getTrusteeProfessionalIds(
    context: ApplicationContext,
    firstName: string,
    lastName: string,
    state: string,
  ): Promise<string[]>;
  /**
   * Return the full set of ACMS trustee professional records from CMMPR
   * (PROF_TYPE = 'TR'), independent of ATS, keyed on the compound
   * `(GROUP_DESIGNATOR, PROF_CODE)` professional ID. Drives the inverse
   * (ACMS → CAMS) professional-ID backfill pass.
   */
  getAllTrusteeProfessionalRecords(
    context: ApplicationContext,
  ): Promise<AcmsTrusteeProfessionalRecord[]>;
  getCmmapAppointments(
    context: ApplicationContext,
    lastId: number,
    pageSize: number,
    cutoffDate: string | null,
  ): Promise<AcmsCaseAppointmentRecord[]>;
  getCmmapAppointmentsRaw(
    context: ApplicationContext,
    lastId: number,
    pageSize: number,
    cutoffDate: string | null,
  ): Promise<AcmsCaseAppointmentRawRecord[]>;
}

export interface AtsGateway {
  getTrusteesPage(
    context: ApplicationContext,
    lastTrusteeId: number | null,
    pageSize: number,
    importAll?: boolean,
  ): Promise<AtsTrusteeRecord[]>;
  /**
   * Get cleansed appointments for a trustee.
   * Returns both clean appointments (for storage) and failed appointments (for DLQ).
   * Gateway handles ATS data cleansing and transformation internally.
   */
  getTrusteeAppointments(
    context: ApplicationContext,
    trusteeId: number,
  ): Promise<TrusteeAppointmentsResult>;
  getTrusteeCount(context: ApplicationContext, importAll?: boolean): Promise<number>;
  testConnection(context: ApplicationContext): Promise<boolean>;
  executeQuery(
    context: ApplicationContext,
    query: string,
    input?: DbTableFieldSpec[],
  ): Promise<QueryResults>;
}

export type CaseHistoryDocumentType = 'AUDIT_ASSIGNMENT' | 'AUDIT_TRANSFER' | 'AUDIT_CONSOLIDATION';

export interface CasesRepository extends Releasable {
  create<T extends { caseId: string; documentType: string }>(data: T): Promise<T>;
  createTransferFrom(reference: TransferFrom): Promise<TransferFrom>;
  createTransferTo(reference: TransferTo): Promise<TransferTo>;
  getTransfers(caseId: string): Promise<Array<TransferFrom | TransferTo>>;
  createConsolidationTo(reference: ConsolidationTo): Promise<ConsolidationTo>;
  createConsolidationFrom(reference: ConsolidationFrom): Promise<ConsolidationFrom>;
  getConsolidation(caseId: string): Promise<Array<ConsolidationTo | ConsolidationFrom>>;
  getCaseHistory(caseId: string): Promise<CaseHistory[]>;
  getAllCaseHistory(documentType: CaseHistoryDocumentType): Promise<CaseHistory[]>;
  createCaseHistory(history: CaseHistory): Promise<void>;
  updateCaseHistory(history: CaseHistory): Promise<void>;
  syncDxtrCase(bCase: SyncedCase): Promise<void>;
  searchCases(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<ResourceActions<SyncedCase>>>;
  searchCasesWithPhoneticTokens(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<ResourceActions<SyncedCase>>>;
  getConsolidationMemberCaseIds(predicate: CasesSearchPredicate): Promise<string[]>;
  getSyncedCase(caseId: string): Promise<SyncedCase>;
  getCaseOrMovedCase(caseId: string): Promise<SyncedCase | null>;
  markAsMoved(caseId: string, movedToCaseId: string, movedOn: string): Promise<void>;
  updateManyByQuery: <T>(query: Query<T>, update: object) => Promise<UpdateResult>;
  findByCursor: <T>(
    query: Query<T>,
    options: { limit: number; sortField: keyof T; sortDirection: 'ASCENDING' | 'DESCENDING' },
  ) => Promise<T[]>;
  getCaseIdsRemainingToSync(
    cutoffDate: string,
    lastId: string | null,
    limit: number,
  ): Promise<{ caseId: string; _id: string }[]>;
  findByCaseIdAndType<T extends { caseId: string; documentType: string }>(
    caseId: string,
    documentType: string,
  ): Promise<T[]>;
  findByCaseId(caseId: string): Promise<unknown[]>;
  delete(id: string): Promise<void>;
  findDuplicateSyncedCases(): Promise<
    Array<{ dxtrId: string; courtId: string; caseIds: string[] }>
  >;
  findSyncedCaseByDxtrId(dxtrId: string, courtId: string): Promise<SyncedCase | undefined>;
}

export interface OfficesRepository
  extends Searches<OfficeUserRolesPredicate, OfficeStaff>, Releasable {
  putOrExtendOfficeStaff(officeCode: string, staff: Staff, expires: string): Promise<void>;
  getOfficeAttorneys(officeCode: string): Promise<AttorneyUser[]>;
  putOfficeStaff(officeCode: string, user: CamsUserReference, ttl?: number): Promise<ReplaceResult>;
  findAndDeleteStaff(officeCode: string, id: string): Promise<void>;
}

export interface ListsRepository extends Releasable {
  getBankruptcySoftwareList(): Promise<BankruptcySoftwareList>;
  getBankList(): Promise<BankList>;
  postBank(item: Creatable<BankListItem>): Promise<string>;
  deleteBank(id: string): Promise<void>;
}

export interface NotificationGateway {
  send(notification: Notification): Promise<void>;
}

export interface NotificationRoutingRepository extends Releasable {
  /** Returns the recipient whose covers array contains the given key, or null. */
  findRecipientByRoutingKey(key: string): Promise<NotificationRecipient | null>;
  /** Returns all routing records. */
  getAll(): Promise<NotificationRoutingRecord[]>;
  /** Updates the recipientAddresses for a routing record by id. */
  updateRoutingRecord(
    id: string,
    input: NotificationRoutingUpdateInput,
  ): Promise<NotificationRoutingRecord>;
  /** Records an audit entry for a routing record change. */
  createRoutingAuditRecord(record: Creatable<NotificationRoutingAuditHistory>): Promise<void>;
}

export interface BanksRepository extends Releasable {
  getBanks(): Promise<BankProfile[]>;
  getBank(id: string): Promise<BankProfile>;
  findBankByName(normalizedName: string): Promise<BankProfile | null>;
  createBank(bank: Creatable<BankProfile>): Promise<BankProfile>;
  updateBank(id: string, bank: BankProfile): Promise<BankProfile>;
  createBankAuditRecord(history: Creatable<BankAuditHistory>): Promise<void>;
  getBankHistory(bankId: string): Promise<BankAuditHistory[]>;
}

export interface BankruptcySoftwareRepository extends Releasable {
  getSoftwareList(): Promise<BankruptcySoftwareProfile[]>;
  findSoftwareById(id: string): Promise<BankruptcySoftwareProfile>;
  findSoftwareByBankId(bankId: string): Promise<BankruptcySoftwareProfile[]>;
  createSoftware(
    software: Creatable<BankruptcySoftwareProfile>,
  ): Promise<BankruptcySoftwareProfile>;
  updateSoftware(id: string, update: BankruptcySoftwareProfile): Promise<BankruptcySoftwareProfile>;
  createSoftwareAuditRecord(history: Creatable<BankruptcySoftwareAuditHistory>): Promise<void>;
  getSoftwareHistory(softwareId: string): Promise<BankruptcySoftwareAuditHistory[]>;
}

export interface UsersRepository extends Releasable {
  getPrivilegedIdentityUser(id: string, includeExpired?: boolean): Promise<PrivilegedIdentityUser>;
  putPrivilegedIdentityUser(
    privilegedIdentityUser: PrivilegedIdentityUser,
    updatedBy: CamsUserReference,
  ): Promise<ReplaceResult>;
  deletePrivilegedIdentityUser(id: string): Promise<void>;
}

export interface OfficeAssigneesRepository
  extends
    Creates<OfficeAssignee>,
    DeletesMany<OfficeAssigneePredicate>,
    Searches<OfficeAssigneePredicate, OfficeAssignee>,
    Releasable {
  getDistinctAssigneesByOffice: (officeCode: string) => Promise<CamsUserReference[]>;
  updateManyByQuery: <T>(query: Query<T>, update: object) => Promise<UpdateResult>;
}

export interface TrusteesRepository extends Reads<Trustee>, Releasable {
  createTrustee(input: TrusteeInput, userRef: CamsUserReference): Promise<Trustee>;
  createTrusteeHistory(history: Creatable<TrusteeHistory>): Promise<void>;
  listTrusteeHistory(trusteeId: string): Promise<TrusteeHistory[]>;
  listTrustees(): Promise<Trustee[]>;
  findTrusteeByLegacyTruId(truId: string): Promise<Trustee | null>;
  findTrusteesByName(name: string): Promise<Trustee[]>;
  searchTrusteesByName(name: string): Promise<Trustee[]>;
  searchTrusteesByPhoneticTokens(tokens: string[]): Promise<Trustee[]>;
  searchTrusteesByNameScored(name: string): Promise<Trustee[]>;
  findTrusteeByNameAndState(
    firstName: string,
    lastName: string,
    state: string,
  ): Promise<Trustee | null>;
  updateTrustee(
    id: string,
    input: Partial<TrusteeInput>,
    userRef: CamsUserReference,
  ): Promise<Trustee>;
  getTrusteeOversightAssignments(trusteeId: string): Promise<TrusteeOversightAssignment[]>;
  createTrusteeOversightAssignment(
    assignment: Omit<TrusteeOversightAssignment, keyof Auditable | keyof Identifiable>,
  ): Promise<TrusteeOversightAssignment>;
  updateTrusteeOversightAssignment(
    id: string,
    updates: Partial<TrusteeOversightAssignment>,
  ): Promise<TrusteeOversightAssignment>;
  findTrusteesBySoftware(
    softwareId: string,
    limit: number,
    offset: number,
  ): Promise<CamsPaginationResponse<TrusteeSummary>>;
  findTrusteesByBank(
    bankId: string,
    limit: number,
    offset: number,
  ): Promise<CamsPaginationResponse<TrusteeSummary>>;
  findTrusteesByBankAndSoftware(
    softwareId: string,
    bankId: string,
    limit: number,
    offset: number,
  ): Promise<CamsPaginationResponse<TrusteeSummary>>;
  countTrusteesByBankAndSoftware(softwareId: string, bankId: string): Promise<number>;
  setPhoneticTokens(trusteeId: string, tokens: string[]): Promise<void>;
  deleteAll(): Promise<number>;
}

export type TrusteeDueDateMetricsAggregation = {
  totalChapter7Appointments: number;
  completeCount: number;
  partialCount: number;
  noneCount: number;
  tprReviewPeriodCount: number;
  pastFieldExamCount: number;
  pastAuditCount: number;
  tirReviewPeriodCount: number;
  tprDueDateCount: number;
  upcomingExamOrAuditYearCount: number;
  lastAuditFiscalYearCount: number;
  tirFrequencyCount: number;
  tirSubmissionCount: number;
  tirReviewDueDateCount: number;
};

export type CaseAppointmentMigrationInput = CaseAppointmentInput & {
  movedToCaseId?: string;
  acmsProfessionalId?: string;
};

export interface TrusteeCaseAppointmentsRepository extends Releasable {
  getByCaseId(caseId: string): Promise<CaseAppointment[]>;
  getActiveByCaseId(caseId: string): Promise<CaseAppointment | null>;
  getCasesForTrustee(
    trusteeId: string,
    predicate: TrusteeCasesSearchPredicate,
  ): Promise<CamsPaginationResponse<TrusteeCaseListItem>>;
  upsert(
    appointment: CaseAppointmentInput | CaseAppointmentMigrationInput,
  ): Promise<CaseAppointment>;
  updateCaseAppointment(appointment: CaseAppointment): Promise<CaseAppointment>;
  delete(id: string): Promise<void>;
  findActiveMissingAppointedDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<CaseAppointment & { _id: string }>>;
  getAllCaseAppointments(
    lastId: string | null,
    limit: number,
  ): Promise<Array<CaseAppointment & { _id: string }>>;
  updateCaseFields(caseId: string, fields: CaseDenormalizedFields): Promise<void>;
  getActiveByTrusteeIdFromTrusteePartition(trusteeId: string): Promise<Array<CaseAppointment>>;
  replaceOneInTrusteePartition(
    query: { caseId: string; trusteeId: string; assignedOn: string },
    document: CaseAppointment & { documentType: 'CASE_APPOINTMENT' },
  ): Promise<void>;
}

export interface TrusteeAppointmentsRepository extends Releasable {
  read(trusteeId: string, appointmentId: string): Promise<TrusteeAppointment>;
  getTrusteeAppointments(trusteeId: string): Promise<TrusteeAppointment[]>;
  getAppointmentsByTrusteeIds(trusteeIds: string[]): Promise<TrusteeAppointment[]>;
  getTrusteeIdsByStatuses(statuses: AppointmentStatus[]): Promise<string[]>;
  createAppointment(
    trusteeId: string,
    appointmentInput: TrusteeAppointmentInput,
    userRef: CamsUserReference,
  ): Promise<TrusteeAppointment>;
  updateAppointment(
    trusteeId: string,
    appointmentId: string,
    appointmentInput: TrusteeAppointmentInput,
    userRef: CamsUserReference,
  ): Promise<TrusteeAppointment>;
  findByCursor<T>(
    query: Query<T>,
    options: { limit: number; sortField: keyof T; sortDirection: 'ASCENDING' | 'DESCENDING' },
  ): Promise<T[]>;
  getChapter7DueDateMetricsAggregation(): Promise<TrusteeDueDateMetricsAggregation>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<number>;
}

export interface TrusteeStaffRepository extends Releasable {
  readStaffMember(trusteeId: string, staffId: string): Promise<TrusteeStaff>;
  getTrusteeStaff(trusteeId: string): Promise<TrusteeStaff[]>;
  createStaffMember(
    trusteeId: string,
    input: TrusteeStaffInput,
    user: CamsUserReference,
  ): Promise<TrusteeStaff>;
  updateStaffMember(
    trusteeId: string,
    staffId: string,
    input: TrusteeStaffInput,
    user: CamsUserReference,
  ): Promise<TrusteeStaff>;
  deleteStaffMember(trusteeId: string, staffId: string): Promise<void>;
}

export type RuntimeStateDocumentType =
  | 'ORDERS_SYNC_STATE'
  | 'OFFICE_STAFF_SYNC_STATE'
  | 'CASES_SYNC_STATE'
  | 'PHONETIC_BACKFILL_STATE'
  | 'CASE_APPOINTMENT_DATE_BACKFILL_STATE'
  | 'MIGRATE_CASE_APPOINTMENTS_STATE'
  | 'HEAL_CASE_APPOINTMENTS_STATE'
  | 'TRUSTEE_MIGRATION_STATE'
  | 'TRUSTEE_APPOINTMENTS_SYNC_STATE'
  | 'TRUSTEE_PETITION_SYNC_STATE'
  | 'TRUSTEE_NOTES_METRICS_STATE'
  | 'DELETED_CASES_SYNC_STATE'
  | 'ZOOM_CSV_IMPORT_STATE'
  | 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE'
  | 'PROFESSIONAL_ID_COUNTER';

export type RuntimeState = {
  id?: string;
  documentType: RuntimeStateDocumentType;
};

export type OrderSyncState = RuntimeState & {
  documentType: 'ORDERS_SYNC_STATE';
  txId: string;
};

// Legacy sync state shape (pre-dual-sync-date)
export type LegacyCasesSyncState = RuntimeState & {
  documentType: 'CASES_SYNC_STATE';
  lastSyncDate: string;
};

// Current sync state shape with dual sync dates
export type CasesSyncState = RuntimeState & {
  documentType: 'CASES_SYNC_STATE';
  lastCasesSyncDate: string;
  lastTransactionsSyncDate: string;
};

export type OfficeStaffSyncState = RuntimeState & {
  documentType: 'OFFICE_STAFF_SYNC_STATE';
  userGroups: CamsUserGroup[];
  users: CamsUserReference[];
  officesWithUsers: UstpOfficeDetails[];
};

export type PhoneticBackfillState = RuntimeState & {
  documentType: 'PHONETIC_BACKFILL_STATE';
  lastId: string | null;
  processedCount: number;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
};

export type CaseAppointmentDateBackfillState = RuntimeState & {
  documentType: 'CASE_APPOINTMENT_DATE_BACKFILL_STATE';
  lastId: string | null;
  processedCount: number;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
};

export type TrusteeAppointmentsDownstreamBackfillState = RuntimeState & {
  documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE';
  lastId: string | null;
  processedCount: number;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
};

export type MigrateCaseAppointmentsState = RuntimeState & {
  documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE';
  lastId: number | null;
  // Atomically incremented counters — accumulate across resume attempts
  processedCount: number;
  failedCount: number;
  reEnqueuedCount: number;
  acmsQueryRetries: number;
  resumeAttempts: number;
  readingCompleted: boolean;

  startedAt: string;
  lastUpdatedAt: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
};

export type HealCaseAppointmentsState = RuntimeState & {
  documentType: 'HEAL_CASE_APPOINTMENTS_STATE';
  lastId: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  startedAt: string;
  lastUpdatedAt: string;
  repairedCount: number;
  checkedCount: number;
};

export type TrusteeAppointmentsSyncState = RuntimeState & {
  documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE';
  lastSyncDate: string;
};

export type TrusteePetitionSyncState = RuntimeState & {
  documentType: 'TRUSTEE_PETITION_SYNC_STATE';
  lastSyncDate: string;
};

export type TrusteeNotesMetricsState = RuntimeState & {
  documentType: 'TRUSTEE_NOTES_METRICS_STATE';
  lastSyncDate: string;
};

export type DeletedCasesSyncState = RuntimeState & {
  documentType: 'DELETED_CASES_SYNC_STATE';
  lastChangeDate: string;
};

export type ProfessionalIdCounterState = RuntimeState & {
  documentType: 'PROFESSIONAL_ID_COUNTER';
  lastAssigned: number;
};

export interface DocumentCollectionAdapter<T> {
  find: (
    query: ConditionOrConjunction<T>,
    sort?: SortSpec,
    limit?: number,
    projection?: Projection<T>,
  ) => Promise<T[]>;
  paginate: (pipelineOrQuery: Pipeline | Query) => Promise<CamsPaginationResponse<T>>;
  findOne: (query: ConditionOrConjunction<T>) => Promise<T>;
  getAll: (sort?: SortSpec) => Promise<T[]>;
  replaceOne: (
    query: ConditionOrConjunction<T>,
    item: unknown,
    upsert?: boolean,
  ) => Promise<ReplaceResult>;
  insertOne: (item: T) => Promise<string>;
  insertMany: (items: T[]) => Promise<string[]>;
  deleteOne: (query: ConditionOrConjunction<T>) => Promise<number>;
  deleteMany: (query: ConditionOrConjunction<T>) => Promise<number>;
  countDocuments: (query: ConditionOrConjunction<T>) => Promise<number>;
  updateOne: (query: ConditionOrConjunction<T>, item: unknown) => Promise<UpdateResult>;
  upsertOne: (
    query: ConditionOrConjunction<T>,
    setFields: Partial<T>,
    insertOnlyFields: Partial<T>,
  ) => Promise<void>;
  countAllDocuments: () => Promise<number>;
  bulkReplace: (
    replacements: Array<{ filter: ConditionOrConjunction<T>; replacement: T }>,
    upsert?: boolean,
  ) => Promise<BulkReplaceResult>;
}

export type CamsPaginationResponse<T> = {
  metadata?: { total: number };
  data: T[];
};

export type OfficeAssignee = {
  caseId: string;
  officeCode: string;
  userId: string;
  name: string;
};

export interface ApiToDataflowsGateway {
  queueCaseAssignmentEvent(event: CaseAssignmentDownstreamEvent): Promise<void>;
  queueTrusteeAppointmentEvent(event: TrusteeAppointmentDownstreamEvent): Promise<void>;
  queueCaseReload(caseId: string): Promise<void>;
}

export interface ObservabilityTrace {
  invocationId: string;
  instanceId: string;
  startTime: number;
}

export interface TraceCompletion {
  success: boolean;
  properties: Record<string, string>;
  measurements: Record<string, number>;
  error?: string;
}

export interface ObservabilityGateway {
  startTrace(invocationId: string): ObservabilityTrace;
  completeTrace(
    trace: ObservabilityTrace,
    eventName: string,
    completion: TraceCompletion,
    metrics?: { name: string; value: number }[],
    logger?: LoggerImpl,
  ): void;
}

export interface TrusteeUpcomingKeyDatesRepository
  extends Reads<TrusteeUpcomingKeyDates | null>, Upserts<TrusteeUpcomingKeyDates>, Releasable {
  getByAppointmentId(appointmentId: string): Promise<TrusteeUpcomingKeyDates | null>;
  createHistory(history: Creatable<TrusteeUpcomingKeyDatesHistory>): Promise<void>;
}

export interface TrusteeMatchVerificationRepository extends Releasable {
  getVerification(caseId: string): Promise<TrusteeMatchVerification | null>;
  findById(id: string): Promise<TrusteeMatchVerification>;
  upsertVerification(doc: TrusteeMatchVerification): Promise<void>;
  search(predicate: { status?: OrderStatus[] }): Promise<TrusteeMatchVerificationSearchResult[]>;
  update(id: string, updates: Partial<TrusteeMatchVerification>): Promise<TrusteeMatchVerification>;
  findVerificationsMissingTaskDate(
    lastId: string | null,
    limit: number,
  ): Promise<Array<TrusteeMatchVerification & { _id: string }>>;
  updateVerificationTaskDate(mongoId: string, taskDate: string): Promise<void>;
  updateManyByQuery: <U>(query: Query<U>, update: object) => Promise<UpdateResult>;
}

export interface UserGroupsRepository extends Releasable {
  upsertUserGroupsBatch(context: ApplicationContext, userGroups: UserGroup[]): Promise<void>;
  getUserGroupsByNames(context: ApplicationContext, groupNames: string[]): Promise<UserGroup[]>;
}

export interface TrusteeProfessionalIdsRepository extends Releasable {
  createProfessionalId(
    camsTrusteeId: string,
    acmsProfessionalId: string,
    user: CamsUserReference,
  ): Promise<TrusteeProfessionalId>;
  findAll(): Promise<TrusteeProfessionalId[]>;
  findByCamsTrusteeId(camsTrusteeId: string): Promise<TrusteeProfessionalId[]>;
  findByAcmsProfessionalId(acmsProfessionalId: string): Promise<TrusteeProfessionalId[]>;
  deleteByCamsTrusteeId(camsTrusteeId: string): Promise<number>;
  deleteAll(): Promise<number>;
}

export type ObjectStorageGateway = {
  readObject(containerName: string, objectName: string): Promise<string | null>;
  writeObject(containerName: string, objectName: string, content: string): Promise<void>;
};
