import { CaseDocket } from './case-docket/case-docket.model';
import { ApplicationContext } from '../adapters/types/basic';
import { CaseAssignmentHistory } from '../adapters/types/case.assignment';
import { Order, OrderSync } from './orders/orders.model';

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
}

// TODO: Move these models to a top level models file?
export type SyncStateDocumentType = 'ORDERS_SYNC_STATE';

export type SyncState = {
  id: string;
  documentType: SyncStateDocumentType;
};

export type OrderSyncState = SyncState & {
  documentType: 'ORDERS_SYNC_STATE';
  txId: number;
};

export interface RuntimeRepository {
  getSyncState<T extends SyncState>(
    context: ApplicationContext,
    documentType: SyncStateDocumentType,
  ): Promise<T>;
  updateSyncState<T extends SyncState>(context: ApplicationContext, syncState: T);
}
