import {
  CasesSearchPredicate,
  OfficeAssigneePredicate,
  OrdersSearchPredicate,
} from '../../../common/src/api/search';
import { ResourceActions } from '../../../common/src/cams/actions';
import { CaseAssignment } from '../../../common/src/cams/assignments';
import { CaseDocket, CaseNote, SyncedCase } from '../../../common/src/cams/cases';
import {
  ConsolidationFrom,
  ConsolidationTo,
  TransferFrom,
  TransferTo,
} from '../../../common/src/cams/events';
import { CaseAssignmentHistory, CaseHistory } from '../../../common/src/cams/history';
import { UstpOfficeDetails } from '../../../common/src/cams/offices';
import {
  ConsolidationOrder,
  Order,
  RawOrderSync,
  TransferOrderAction,
} from '../../../common/src/cams/orders';
import { CamsSession } from '../../../common/src/cams/session';
import {
  AttorneyUser,
  CamsUserGroup,
  CamsUserReference,
  PrivilegedIdentityUser,
  Staff,
} from '../../../common/src/cams/users';
import { ApplicationContext } from '../adapters/types/basic';
import { ConditionOrConjunction, Query, SortSpec } from '../query/query-builder';
import { Pipeline } from '../query/query-pipeline';
import { AcmsConsolidation, AcmsPredicate } from './dataflows/migrate-consolidations';

export interface AcmsGateway {
  emptyMigrationTable(context: ApplicationContext);
  getConsolidationDetails(
    context: ApplicationContext,
    leadCaseId: string,
  ): Promise<AcmsConsolidation>;
  getLeadCaseIds(context: ApplicationContext, predicateAndPage: AcmsPredicate): Promise<string[]>;
  getMigrationCaseCount(context: ApplicationContext);
  getMigrationCaseIds(context: ApplicationContext, start: number, end: number);
  loadMigrationTable(context: ApplicationContext);
}

export type CamsPaginationResponse<T> = {
  data: T[];
  metadata?: { total: number };
};

export interface CaseAssignmentRepository<T = CaseAssignment>
  extends Creates<T, string>,
    Updates<CaseAssignment, string> {
  findAssignmentsByAssignee(userId: string): Promise<CaseAssignment[]>;
  getAllActiveAssignments(): Promise<CaseAssignment[]>;
  getAssignmentsForCases(caseIds: string[]): Promise<Map<string, CaseAssignment[]>>;
}

export interface CaseDocketGateway {
  getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket>;
}

export interface CaseHistoryGateway {
  getCaseAssignmentHistory(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseAssignmentHistory[]>;
}

export interface CaseNotesRepository<T = CaseNote>
  extends Creates<T, T>,
    Reads<T>,
    Updates<Partial<T>> {
  archiveCaseNote(archiveNote: Partial<CaseNote>): Promise<UpdateResult>;
  getNotesByCaseId(caseId: string): Promise<CaseNote[]>;
}

export interface CasesRepository extends Releasable {
  createCaseHistory(history: CaseHistory): Promise<void>;
  createConsolidationFrom(reference: ConsolidationFrom): Promise<ConsolidationFrom>;
  createConsolidationTo(reference: ConsolidationTo): Promise<ConsolidationTo>;
  createTransferFrom(reference: TransferFrom): Promise<TransferFrom>;
  createTransferTo(reference: TransferTo): Promise<TransferTo>;
  deleteSyncedCases(): Promise<void>;
  getCaseHistory(caseId: string): Promise<CaseHistory[]>;
  getConsolidation(caseId: string): Promise<Array<ConsolidationFrom | ConsolidationTo>>;
  getConsolidationChildCaseIds(predicate: CasesSearchPredicate): Promise<string[]>;
  getSyncedCase(caseId: string): Promise<SyncedCase>;
  getTransfers(caseId: string): Promise<Array<TransferFrom | TransferTo>>;
  searchCases(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<ResourceActions<SyncedCase>>>;
  syncDxtrCase(bCase: SyncedCase): Promise<void>;
}

export type CasesSyncState = RuntimeState & {
  documentType: 'CASES_SYNC_STATE';
  lastSyncDate: string;
};

export interface ConsolidationOrdersRepository<T = ConsolidationOrder>
  extends Creates<T, T>,
    CreatesMany<T>,
    Deletes,
    Reads<T>,
    Releasable,
    Searches<OrdersSearchPredicate, T> {}

export interface DocumentCollectionAdapter<T> {
  countAllDocuments: () => Promise<number>;
  countDocuments: (query: ConditionOrConjunction<T>) => Promise<number>;
  deleteMany: (query: ConditionOrConjunction<T>) => Promise<number>;
  deleteOne: (query: ConditionOrConjunction<T>) => Promise<number>;
  find: (query: ConditionOrConjunction<T>, sort?: SortSpec) => Promise<T[]>;
  findOne: (query: ConditionOrConjunction<T>) => Promise<T>;
  getAll: (sort?: SortSpec) => Promise<T[]>;
  insertMany: (items: T[]) => Promise<string[]>;
  insertOne: (item: T) => Promise<string>;
  paginate: (pipelineOrQuery: Pipeline | Query) => Promise<CamsPaginationResponse<T>>;
  replaceOne: (
    query: ConditionOrConjunction<T>,
    item: unknown,
    upsert?: boolean,
  ) => Promise<ReplaceResult>;
  updateOne: (query: ConditionOrConjunction<T>, item: unknown) => Promise<UpdateResult>;
}

export type LogicalQueueNames = 'CASE_ASSIGNMENT_EVENT' | 'CASE_CLOSED_EVENT';

export type OfficeAssignee = {
  caseId: string;
  name: string;
  officeCode: string;
  userId: string;
};

export interface OfficeAssigneesRepository
  extends Creates<OfficeAssignee>,
    DeletesMany<OfficeAssigneePredicate>,
    Releasable,
    Searches<OfficeAssigneePredicate, OfficeAssignee> {
  getDistinctAssigneesByOffice: (officeCode) => Promise<CamsUserReference[]>;
}

export interface OfficesRepository extends Releasable {
  findAndDeleteStaff(officeCode: string, id: string): Promise<void>;
  getOfficeAttorneys(officeCode: string): Promise<AttorneyUser[]>;
  putOfficeStaff(officeCode: string, user: CamsUserReference, ttl?: number): Promise<ReplaceResult>;
  putOrExtendOfficeStaff(officeCode: string, staff: Staff, expires: string): Promise<void>;
}

export type OfficeStaffSyncState = RuntimeState & {
  documentType: 'OFFICE_STAFF_SYNC_STATE';
  officesWithUsers: UstpOfficeDetails[];
  userGroups: CamsUserGroup[];
  users: CamsUserReference[];
};

export interface OrdersGateway {
  getOrderSync(context: ApplicationContext, txId: string): Promise<RawOrderSync>;
}

export interface OrdersRepository<T = Order>
  extends CreatesMany<T, T[]>,
    Reads<T>,
    Releasable,
    Searches<OrdersSearchPredicate, T>,
    Updates<TransferOrderAction> {}

export type OrderSyncState = RuntimeState & {
  documentType: 'ORDERS_SYNC_STATE';
  txId: string;
};

export interface QueueGateway {
  using<T = unknown>(
    context: ApplicationContext,
    queueName: LogicalQueueNames,
  ): { enqueue: (...messages: T[]) => void };
}

export interface Releasable {
  release: () => void;
}

export type ReplaceResult = {
  id: string;
  modifiedCount: number;
  upsertedCount: number;
};

export type RuntimeState = {
  documentType: RuntimeStateDocumentType;
  id?: string;
};

export type RuntimeStateDocumentType =
  | 'CASES_SYNC_STATE'
  | 'OFFICE_STAFF_SYNC_STATE'
  | 'ORDERS_SYNC_STATE';

export interface RuntimeStateRepository<T extends RuntimeState = RuntimeState>
  extends Reads<T>,
    Upserts<T, T> {}

export type UpdateResult = {
  matchedCount: number;
  modifiedCount: number;
};

export type UpsertResult = ReplaceResult;

export interface UserSessionCacheRepository<T = CamsSession>
  extends Reads<T>,
    Releasable,
    Upserts<T, T> {}

export interface UsersRepository extends Releasable {
  deletePrivilegedIdentityUser(id: string): Promise<void>;
  getPrivilegedIdentityUser(id: string, includeExpired?: boolean): Promise<PrivilegedIdentityUser>;
  putPrivilegedIdentityUser(
    privilegedIdentityUser: PrivilegedIdentityUser,
    updatedBy: CamsUserReference,
  ): Promise<ReplaceResult>;
}

interface Creates<T, R = void> {
  create(data: T): Promise<R>;
}

interface CreatesMany<T, R = void> {
  createMany(data: T[]): Promise<R>;
}

interface Deletes {
  delete(id: string): Promise<void>;
}

interface DeletesMany<T> {
  deleteMany(predicate: T): Promise<void>;
}

interface Reads<R> {
  read(id: string, key?: string): Promise<R>;
}

interface Searches<P, R> {
  search(predicate?: P): Promise<R[]>;
}

interface Updates<T, R = void> {
  update(data: T): Promise<R>;
}

interface Upserts<T, R = void> {
  upsert(data: T): Promise<R>;
}
