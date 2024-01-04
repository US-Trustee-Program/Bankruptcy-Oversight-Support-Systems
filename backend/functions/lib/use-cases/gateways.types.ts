import { CaseDocket } from './case-docket/case-docket.model';
import { ApplicationContext } from '../adapters/types/basic';
import { CaseAssignmentHistory } from '../adapters/types/case.assignment';
import { Order, OrderSync, OrderTransfer } from './orders/orders.model';

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
  getOrderSync(context: ApplicationContext, txId: number): Promise<OrderSync>;
}

export interface OrdersRepository {
  getOrders(context: ApplicationContext): Promise<Order[]>;
  putOrders(context: ApplicationContext, orders: Order[]);
  updateOrder(context: ApplicationContext, id: string, data: OrderTransfer);
}

// TODO: Move these models to a top level models file?
export type RuntimeStateDocumentType = 'ORDERS_SYNC_STATE';

export type RuntimeState = {
  id: string;
  documentType: RuntimeStateDocumentType;
};

export type OrderSyncState = RuntimeState & {
  documentType: 'ORDERS_SYNC_STATE';
  txId: number;
};

export interface RuntimeStateRepository {
  getState<T extends RuntimeState>(
    context: ApplicationContext,
    documentType: RuntimeStateDocumentType,
  ): Promise<T>;
  updateState<T extends RuntimeState>(context: ApplicationContext, syncState: T);
}
