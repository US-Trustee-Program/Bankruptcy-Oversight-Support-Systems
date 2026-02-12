import { ApplicationContext } from '../adapters/types/basic';
import { ConsolidationOrder, Order, RawOrderSync, TransferOrderAction } from '@common/cams/orders';
import { ConsolidationTo, ConsolidationFrom, TransferFrom, TransferTo } from '@common/cams/events';
import { CaseHistory } from '@common/cams/history';
import { CaseDocket, CaseNote, SyncedCase } from '@common/cams/cases';
import {
  CasesSearchPredicate,
  OfficeAssigneePredicate,
  OfficeUserRolesPredicate,
  OrdersSearchPredicate,
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
import { CamsSession } from '@common/cams/session';
import { ConditionOrConjunction, Query, SortSpec } from '../query/query-builder';
import { AcmsConsolidation, AcmsPredicate } from './dataflows/migrate-consolidations';
import { Pipeline } from '../query/query-pipeline';
import { ResourceActions } from '@common/cams/actions';
import { OfficeStaff } from '../adapters/gateways/mongo/offices.mongo.repository';
import {
  Trustee,
  TrusteeHistory,
  TrusteeInput,
  TrusteeOversightAssignment,
} from '@common/cams/trustees';
import { TrusteeAppointment, TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { Auditable } from '@common/cams/auditable';
import {
  BankList,
  BankListItem,
  BankruptcySoftwareList,
  BankruptcySoftwareListItem,
} from '@common/cams/lists';
import { Creatable } from '@common/cams/creatable';
import { Identifiable } from '@common/cams/document';

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
  updateManyByQuery: (query: Query<T>, update: unknown) => Promise<UpdateResult>;
}

export interface UserSessionCacheRepository<T = CamsSession>
  extends Reads<T>, Upserts<T, T>, Releasable {}

export interface CaseAssignmentRepository<T = CaseAssignment>
  extends Creates<T, string>, Updates<CaseAssignment, string> {
  getAssignmentsForCases(caseIds: string[]): Promise<Map<string, CaseAssignment[]>>;
  findAssignmentsByAssignee(userId: string): Promise<CaseAssignment[]>;
  getAllActiveAssignments(): Promise<CaseAssignment[]>;
}

export interface CaseNotesRepository<T = CaseNote>
  extends Creates<T, T>, Updates<Partial<T>>, Reads<T> {
  getNotesByCaseId(caseId: string): Promise<CaseNote[]>;
  archiveCaseNote(archiveNote: Partial<CaseNote>): Promise<UpdateResult>;
}

export interface OrdersRepository<T = Order>
  extends
    Searches<OrdersSearchPredicate, T>,
    CreatesMany<T, T[]>,
    Reads<T>,
    Updates<TransferOrderAction>,
    Releasable {}

export interface RuntimeStateRepository<T extends RuntimeState = RuntimeState>
  extends Reads<T>, Upserts<T, T> {}

export interface CaseDocketGateway {
  getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket>;
}

export interface OrdersGateway {
  getOrderSync(context: ApplicationContext, txId: string): Promise<RawOrderSync>;
}

export interface AcmsGateway {
  getLeadCaseIds(context: ApplicationContext, predicateAndPage: AcmsPredicate): Promise<string[]>;
  getConsolidationDetails(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsConsolidation>;
  loadMigrationTable(context: ApplicationContext);
  getMigrationCaseIds(context: ApplicationContext, start: number, end: number);
  emptyMigrationTable(context: ApplicationContext);
  getMigrationCaseCount(context: ApplicationContext);
}

export interface AtsGateway {
  getTrusteesPage(
    context: ApplicationContext,
    lastTrusteeId: number | null,
    pageSize: number,
  ): Promise<import('../adapters/types/ats.types').AtsTrusteeRecord[]>;
  getTrusteeAppointments(
    context: ApplicationContext,
    trusteeId: number,
  ): Promise<import('../adapters/types/ats.types').AtsAppointmentRecord[]>;
  getTrusteeCount(context: ApplicationContext): Promise<number>;
  testConnection(context: ApplicationContext): Promise<boolean>;
}

export type CaseHistoryDocumentType = 'AUDIT_ASSIGNMENT' | 'AUDIT_TRANSFER' | 'AUDIT_CONSOLIDATION';

export interface CasesRepository extends Releasable {
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
  updateManyByQuery: <T>(query: Query<T>, update: unknown) => Promise<UpdateResult>;
  findByCursor: <T>(
    query: Query<T>,
    options: { limit: number; sortField: keyof T; sortDirection: 'ASCENDING' | 'DESCENDING' },
  ) => Promise<T[]>;
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
  postBankruptcySoftware(item: Creatable<BankruptcySoftwareListItem>): Promise<string>;
  getBankList(): Promise<BankList>;
  postBank(item: Creatable<BankListItem>): Promise<string>;
  deleteBankruptcySoftware(id: string): Promise<void>;
  deleteBank(id: string): Promise<void>;
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
}

export interface TrusteesRepository extends Reads<Trustee>, Releasable {
  createTrustee(input: TrusteeInput, userRef: CamsUserReference): Promise<Trustee>;
  createTrusteeHistory(history: Creatable<TrusteeHistory>): Promise<void>;
  listTrusteeHistory(trusteeId: string): Promise<TrusteeHistory[]>;
  listTrustees(): Promise<Trustee[]>;
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
}

export interface TrusteeAppointmentsRepository extends Reads<TrusteeAppointment>, Releasable {
  getTrusteeAppointments(trusteeId: string): Promise<TrusteeAppointment[]>;
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
}

export type RuntimeStateDocumentType =
  | 'ORDERS_SYNC_STATE'
  | 'OFFICE_STAFF_SYNC_STATE'
  | 'CASES_SYNC_STATE'
  | 'PHONETIC_BACKFILL_STATE'
  | 'TRUSTEE_MIGRATION_STATE';

export type RuntimeState = {
  id?: string;
  documentType: RuntimeStateDocumentType;
};

export type OrderSyncState = RuntimeState & {
  documentType: 'ORDERS_SYNC_STATE';
  txId: string;
};

export type CasesSyncState = RuntimeState & {
  documentType: 'CASES_SYNC_STATE';
  lastSyncDate: string;
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

export interface DocumentCollectionAdapter<T> {
  find: (query: ConditionOrConjunction<T>, sort?: SortSpec) => Promise<T[]>;
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

export type LogicalQueueNames = 'CASE_ASSIGNMENT_EVENT' | 'CASE_CLOSED_EVENT';

export interface QueueGateway {
  using<T = unknown>(
    context: ApplicationContext,
    queueName: LogicalQueueNames,
  ): { enqueue: (...messages: T[]) => void };
}

export interface UserGroupsRepository extends Releasable {
  upsertUserGroupsBatch(context: ApplicationContext, userGroups: UserGroup[]): Promise<void>;
  getUserGroupsByNames(context: ApplicationContext, groupNames: string[]): Promise<UserGroup[]>;
}
