import { CaseDocket } from './case-docket/case-docket.model';
import { ApplicationContext } from '../adapters/types/basic';
import {
  ConsolidationOrder,
  Order,
  RawOrderSync,
  TransferOrderAction,
} from '../../../../common/src/cams/orders';
import {
  ConsolidationTo,
  TransferIn,
  TransferOut,
  ConsolidationFrom,
} from '../../../../common/src/cams/events';
import { CaseAssignmentHistory, CaseHistory } from '../../../../common/src/cams/history';

export interface RepositoryResource {
  id?: string;
}

export interface DocumentRepository<T extends RepositoryResource> {
  get(context: ApplicationContext, id: string, partitionKey: string): Promise<T>;
  update(context: ApplicationContext, id: string, partitionKey: string, data: T);
  put(context: ApplicationContext, data: T): Promise<T>;
  putAll(context: ApplicationContext, list: T[]): Promise<T[]>;
  delete(context: ApplicationContext, id: string, partitionKey: string);
}

export interface ConsolidationOrdersRepository extends DocumentRepository<ConsolidationOrder> {
  getAll(context: ApplicationContext): Promise<ConsolidationOrder[]>;
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

export interface OrdersGateway {
  getOrderSync(context: ApplicationContext, txId: string): Promise<RawOrderSync>;
}

export interface OrdersRepository {
  getOrders(context: ApplicationContext): Promise<Order[]>;
  getOrder(context: ApplicationContext, id: string, partitionKey: string): Promise<Order>;
  putOrders(context: ApplicationContext, orders: Order[]): Promise<Order[]>;
  updateOrder(context: ApplicationContext, id: string, data: TransferOrderAction);
}

export interface CasesRepository {
  createTransferIn(context: ApplicationContext, transfer: TransferIn): Promise<TransferIn>;
  createTransferOut(context: ApplicationContext, transfer: TransferOut): Promise<TransferOut>;
  getTransfers(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<TransferIn | TransferOut>>;
  createConsolidationTo(
    context: ApplicationContext,
    transfer: ConsolidationTo,
  ): Promise<ConsolidationTo>;
  createConsolidationFrom(
    context: ApplicationContext,
    transfer: ConsolidationFrom,
  ): Promise<ConsolidationFrom>;
  getConsolidation(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<ConsolidationTo | ConsolidationFrom>>;
  getCaseHistory(context: ApplicationContext, caseId: string): Promise<CaseHistory[]>;
  createCaseHistory(context: ApplicationContext, history: CaseHistory);
}

// TODO: Move these models to a top level models file?
export type RuntimeStateDocumentType = 'ORDERS_SYNC_STATE';

export type RuntimeState = {
  id?: string;
  documentType: RuntimeStateDocumentType;
};

export type OrderSyncState = RuntimeState & {
  documentType: 'ORDERS_SYNC_STATE';
  txId: string;
};

export interface RuntimeStateRepository {
  getState<T extends RuntimeState>(
    context: ApplicationContext,
    documentType: RuntimeStateDocumentType,
  ): Promise<T>;
  updateState<T extends RuntimeState>(context: ApplicationContext, syncState: T);
  createState<T extends RuntimeState>(context: ApplicationContext, syncState: T): Promise<T>;
}
