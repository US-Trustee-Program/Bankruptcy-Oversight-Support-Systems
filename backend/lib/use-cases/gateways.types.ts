import { ApplicationContext } from '../adapters/types/basic';
import {
  ConsolidationOrder,
  Order,
  RawOrderSync,
  TransferOrderAction,
} from '../../../common/src/cams/orders';
import {
  ConsolidationTo,
  ConsolidationFrom,
  TransferFrom,
  TransferTo,
} from '../../../common/src/cams/events';
import { CaseAssignmentHistory, CaseHistory } from '../../../common/src/cams/history';
import { CaseDocket, CaseNote, SyncedCase } from '../../../common/src/cams/cases';
import {
  CasesSearchPredicate,
  OfficeAssigneePredicate,
  OfficeUserRolesPredicate,
  OrdersSearchPredicate,
} from '../../../common/src/api/search';
import {
  AttorneyUser,
  PrivilegedIdentityUser,
  CamsUserGroup,
  CamsUserReference,
  Staff,
} from '../../../common/src/cams/users';
import { UstpOfficeDetails } from '../../../common/src/cams/offices';
import { CaseAssignment } from '../../../common/src/cams/assignments';
import { CamsSession } from '../../../common/src/cams/session';
import { ConditionOrConjunction, Query, SortSpec } from '../query/query-builder';
import { AcmsConsolidation, AcmsPredicate } from './dataflows/migrate-consolidations';
import { Pipeline } from '../query/query-pipeline';
import { ResourceActions } from '../../../common/src/cams/actions';
import { OfficeStaff } from '../adapters/gateways/mongo/offices.mongo.repository';

export type ReplaceResult = {
  id: string;
  modifiedCount: number;
  upsertedCount: number;
};

export type UpdateResult = {
  modifiedCount: number;
  matchedCount: number;
};

export type UpsertResult = ReplaceResult;

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
  extends Searches<OrdersSearchPredicate, T>,
    Creates<T, T>,
    CreatesMany<T>,
    Reads<T>,
    Deletes,
    Updates<T, T>,
    Releasable {
  count: (keyRoot: string) => Promise<number>;
}

export interface UserSessionCacheRepository<T = CamsSession>
  extends Reads<T>,
    Upserts<T, T>,
    Releasable {}

export interface CaseAssignmentRepository<T = CaseAssignment>
  extends Creates<T, string>,
    Updates<CaseAssignment, string> {
  getAssignmentsForCases(caseIds: string[]): Promise<Map<string, CaseAssignment[]>>;
  findAssignmentsByAssignee(userId: string): Promise<CaseAssignment[]>;
  getAllActiveAssignments(): Promise<CaseAssignment[]>;
}

export interface CaseNotesRepository<T = CaseNote>
  extends Creates<T, T>,
    Updates<Partial<T>>,
    Reads<T> {
  getNotesByCaseId(caseId: string): Promise<CaseNote[]>;
  archiveCaseNote(archiveNote: Partial<CaseNote>): Promise<UpdateResult>;
}

export interface OrdersRepository<T = Order>
  extends Searches<OrdersSearchPredicate, T>,
    CreatesMany<T, T[]>,
    Reads<T>,
    Updates<TransferOrderAction>,
    Releasable {}

export interface RuntimeStateRepository<T extends RuntimeState = RuntimeState>
  extends Reads<T>,
    Upserts<T, T> {}

export interface CaseDocketGateway {
  getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket>;
}

export interface CaseHistoryGateway {
  getCaseAssignmentHistory(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseAssignmentHistory[]>;
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

export interface CasesRepository extends Releasable {
  createTransferFrom(reference: TransferFrom): Promise<TransferFrom>;
  createTransferTo(reference: TransferTo): Promise<TransferTo>;
  getTransfers(caseId: string): Promise<Array<TransferFrom | TransferTo>>;
  createConsolidationTo(reference: ConsolidationTo): Promise<ConsolidationTo>;
  createConsolidationFrom(reference: ConsolidationFrom): Promise<ConsolidationFrom>;
  getConsolidation(caseId: string): Promise<Array<ConsolidationTo | ConsolidationFrom>>;
  getCaseHistory(caseId: string): Promise<CaseHistory[]>;
  createCaseHistory(history: CaseHistory): Promise<void>;
  syncDxtrCase(bCase: SyncedCase): Promise<void>;
  searchCases(
    predicate: CasesSearchPredicate,
  ): Promise<CamsPaginationResponse<ResourceActions<SyncedCase>>>;
  getConsolidationChildCaseIds(predicate: CasesSearchPredicate): Promise<string[]>;
  deleteSyncedCases(): Promise<void>;
  getSyncedCase(caseId: string): Promise<SyncedCase>;
}

export interface OfficesRepository
  extends Searches<OfficeUserRolesPredicate, OfficeStaff>,
    Releasable {
  putOrExtendOfficeStaff(officeCode: string, staff: Staff, expires: string): Promise<void>;
  getOfficeAttorneys(officeCode: string): Promise<AttorneyUser[]>;
  putOfficeStaff(officeCode: string, user: CamsUserReference, ttl?: number): Promise<ReplaceResult>;
  findAndDeleteStaff(officeCode: string, id: string): Promise<void>;
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
  extends Creates<OfficeAssignee>,
    DeletesMany<OfficeAssigneePredicate>,
    Searches<OfficeAssigneePredicate, OfficeAssignee>,
    Releasable {
  getDistinctAssigneesByOffice: (officeCode) => Promise<CamsUserReference[]>;
}

export type RuntimeStateDocumentType =
  | 'ORDERS_SYNC_STATE'
  | 'OFFICE_STAFF_SYNC_STATE'
  | 'CASES_SYNC_STATE';

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

// TODO: Delete these types once the consolidation order `consolidationId` values have been migrated.
export type MigrationConsolidationOrder = Pick<ConsolidationOrder, 'id' | 'jobId' | 'status'>;
export type UpdateConsolidationId = Pick<ConsolidationOrder, 'id' | 'consolidationId'>;
