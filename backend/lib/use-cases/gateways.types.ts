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
import { CaseDocket } from '../../../common/src/cams/cases';
import { OrdersSearchPredicate } from '../../../common/src/api/search';
import { AttorneyUser, CamsUserGroup, CamsUserReference } from '../../../common/src/cams/users';
import { UstpOfficeDetails } from '../../../common/src/cams/offices';
import { CaseAssignment } from '../../../common/src/cams/assignments';
import { CamsSession } from '../../../common/src/cams/session';
import { ConditionOrConjunction, Sort } from '../query/query-builder';
import { AcmsConsolidation, AcmsPredicate } from './acms-orders/acms-orders';

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

interface Searches<P, R> {
  search(predicate?: P): Promise<R[]>;
}

export interface ConsolidationOrdersRepository<T = ConsolidationOrder>
  extends Searches<OrdersSearchPredicate, T>,
    Creates<T, T>,
    CreatesMany<T>,
    Reads<T>,
    Deletes,
    Releasable {}

export interface UserSessionCacheRepository<T = CamsSession>
  extends Reads<T>,
    Upserts<T, T>,
    Releasable {}

export interface CaseAssignmentRepository<T = CaseAssignment>
  extends Creates<T, string>,
    Updates<CaseAssignment, string> {
  findAssignmentsByCaseId(caseIds: string[]): Promise<Map<string, CaseAssignment[]>>;
  findAssignmentsByAssignee(userId: string): Promise<CaseAssignment[]>;
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
  deleteMigrations(): Promise<void>;
}

export interface OfficesRepository extends Releasable {
  getOfficeAttorneys(officeCode: string): Promise<AttorneyUser[]>;
  putOfficeStaff(officeCode: string, user: CamsUserReference, ttl?: number): Promise<void>;
  findAndDeleteStaff(officeCode: string, id: string): Promise<void>;
}

// TODO: Move these models to a top level models file?
export type RuntimeStateDocumentType = 'ORDERS_SYNC_STATE' | 'OFFICE_STAFF_SYNC_STATE';

export type RuntimeState = {
  id?: string;
  documentType: RuntimeStateDocumentType;
};

export type OrderSyncState = RuntimeState & {
  documentType: 'ORDERS_SYNC_STATE';
  txId: string;
};

export type OfficeStaffSyncState = RuntimeState & {
  documentType: 'OFFICE_STAFF_SYNC_STATE';
  userGroups: CamsUserGroup[];
  users: CamsUserReference[];
  officesWithUsers: UstpOfficeDetails[];
};

export interface DocumentCollectionAdapter<T> {
  find: (query: ConditionOrConjunction, sort?: Sort) => Promise<T[]>;
  findOne: (query: ConditionOrConjunction) => Promise<T>;
  getAll: (sort?: Sort) => Promise<T[]>;
  replaceOne: (query: ConditionOrConjunction, item: unknown, upsert?: boolean) => Promise<string>;
  insertOne: (item: unknown) => Promise<string>;
  insertMany: (items: unknown[]) => Promise<string[]>;
  deleteOne: (query: ConditionOrConjunction) => Promise<number>;
  deleteMany: (query: ConditionOrConjunction) => Promise<number>;
  countDocuments: (query: ConditionOrConjunction) => Promise<number>;
  countAllDocuments: () => Promise<number>;
}
