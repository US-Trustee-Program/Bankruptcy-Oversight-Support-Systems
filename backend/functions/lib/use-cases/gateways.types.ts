import { ApplicationContext } from '../adapters/types/basic';
import {
  ConsolidationOrder,
  Order,
  RawOrderSync,
  TransferOrderAction,
} from '../../../../common/src/cams/orders';
import {
  ConsolidationTo,
  ConsolidationFrom,
  TransferFrom,
  TransferTo,
} from '../../../../common/src/cams/events';
import { CaseAssignmentHistory, CaseHistory } from '../../../../common/src/cams/history';
import { CaseDocket } from '../../../../common/src/cams/cases';
import { OrdersSearchPredicate } from '../../../../common/src/api/search';
import { AttorneyUser, CamsUserGroup, CamsUserReference } from '../../../../common/src/cams/users';
import { UstpOfficeDetails } from '../../../../common/src/cams/offices';
import { CamsDocument } from '../../../../common/src/cams/document';
import { CaseAssignment } from '../../../../common/src/cams/assignments';

export interface RepositoryResource {
  id?: string;
}

export interface DocumentRepository<T extends RepositoryResource> {
  create(context: ApplicationContext, data: T): Promise<T | void>;
  createMany(context: ApplicationContext, list: T[]): Promise<T[] | void>;
  read(context: ApplicationContext, id: string, partitionKey: string): Promise<T>;
  update(context: ApplicationContext, id: string, partitionKey: string, data: T): Promise<T | void>;
  upsert(context: ApplicationContext, partitionKey: string, data: T): Promise<T | void>;
  delete(context: ApplicationContext, id: string, partitionKey: string): Promise<void>;
}

interface Creates<T, R = void> {
  create(context: ApplicationContext, data: T): Promise<R>;
}

interface CreatesMany<T, R = void> {
  createMany(context: ApplicationContext, data: T[]): Promise<R>;
}

interface Reads<R> {
  read(context: ApplicationContext, id: string, partitionKey: string): Promise<R>;
}

interface Updates<T, R = void> {
  update(context: ApplicationContext, id: string, data: T): Promise<R>;
}

interface Deletes {
  delete(context: ApplicationContext, id: string, partitionKey: string): Promise<void>;
}

interface Searches<P, R> {
  search(context: ApplicationContext, predicate?: P): Promise<R[]>;
}

///////////////////////
// Composite interfaces from Atoms
///////////////////////

export interface ConsolidationOrdersRepository<T = ConsolidationOrder>
  extends Searches<OrdersSearchPredicate, T>,
    Creates<T, T>,
    CreatesMany<T>,
    Reads<T>,
    Deletes {}

export interface CaseAssignmentRepository<T = CaseAssignment>
  extends Creates<T, string>,
    Updates<CaseAssignment, string> {
  findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]>;
  findAssignmentsByAssignee(userId: string): Promise<CaseAssignment[]>;
}

export interface OrdersRepository<T = Order>
  extends Searches<OrdersSearchPredicate, T>,
    CreatesMany<T, T[]>,
    Reads<T>,
    Updates<TransferOrderAction> {}

export interface RuntimeStateRepository<T = RuntimeState, R = string>
  extends Reads<T>,
    Creates<T, R>,
    Updates<RuntimeState> {}

export interface LocalDocumentRepository<T extends CamsDocument, S>
  extends Searches<S, T>,
    Creates<T, T>,
    Deletes {}

///////////////////////
// TODO Refactor below this line
///////////////////////
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

export interface CasesRepository {
  createTransferFrom(context: ApplicationContext, reference: TransferFrom): Promise<TransferFrom>;
  createTransferTo(context: ApplicationContext, reference: TransferTo): Promise<TransferTo>;
  getTransfers(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<TransferFrom | TransferTo>>;
  createConsolidationTo(
    context: ApplicationContext,
    reference: ConsolidationTo,
  ): Promise<ConsolidationTo>;
  createConsolidationFrom(
    context: ApplicationContext,
    reference: ConsolidationFrom,
  ): Promise<ConsolidationFrom>;
  getConsolidation(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<ConsolidationTo | ConsolidationFrom>>;
  getCaseHistory(context: ApplicationContext, caseId: string): Promise<CaseHistory[]>;
  createCaseHistory(context: ApplicationContext, history: CaseHistory);
}

export interface OfficesRepository {
  getOfficeAttorneys(context: ApplicationContext, officeCode: string): Promise<AttorneyUser[]>;
  putOfficeStaff(
    context: ApplicationContext,
    officeCode: string,
    user: CamsUserReference,
  ): Promise<void>;
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
