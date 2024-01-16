import { CaseDocket } from './case-docket/case-docket.model';
import { ApplicationContext } from '../adapters/types/basic';
import { CaseAssignmentHistory } from '../adapters/types/case.assignment';
import { Order, OrderSync, OrderTransfer, TransferIn, TransferOut } from './orders/orders.model';

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
  getOrderSync(context: ApplicationContext, txId: string): Promise<OrderSync>;
}

export interface OrdersRepository {
  getOrders(context: ApplicationContext): Promise<Order[]>;
  getOrder(context: ApplicationContext, id: string, caseId: string): Promise<Order>;
  putOrders(context: ApplicationContext, orders: Order[]);
  updateOrder(context: ApplicationContext, id: string, data: OrderTransfer);
}

export interface CasesRepository {
  createTransferIn(context: ApplicationContext, transfer: TransferIn): Promise<TransferIn>;
  createTransferOut(context: ApplicationContext, transfer: TransferOut): Promise<TransferOut>;
  getTransfers(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<TransferIn | TransferOut>>;
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
