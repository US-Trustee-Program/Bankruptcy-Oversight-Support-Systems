import {
  OrderSyncState,
  OrdersGateway,
  OrdersRepository,
  RuntimeRepository,
} from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { Order } from './orders.model';

export class OrdersUseCase {
  private readonly ordersGateway: OrdersGateway;
  private readonly ordersRepo: OrdersRepository;
  private readonly runtimeRepo: RuntimeRepository;

  constructor(
    ordersRepo: OrdersRepository,
    ordersGateway: OrdersGateway,
    runtimeRepo: RuntimeRepository,
  ) {
    this.ordersRepo = ordersRepo;
    this.ordersGateway = ordersGateway;
    this.runtimeRepo = runtimeRepo;
  }

  public async getOrders(context: ApplicationContext): Promise<Array<Order>> {
    return this.ordersRepo.getOrders(context);
  }

  // TODO: Implement updateOrder logic. Write transaction state to Cosmos. Partial?
  // public async updateOrder(context: ApplicationContext, order: Order): Promise<Order>

  // TODO: Consider a function to record orders in cosmos which triggers on a schedule.
  /*

  Data Sync Function

  Use max TX_ID from AO_TX table in the query to return all records since the last sync. Keep the max TX_ID state in the Cosmos DB.

  Lifecycle: pending -> order confirmed -> "transfering" -> order complete -> DONE.
                     -> order rejected -> DONE.

  Cosmos Document Design

  collection: orders
  partition key: caseId
  index on: caseId, status, documentType/orderType, court?, region? office? other?

  {
    //
    // READ ONLY attributes originating from DXTR.
    //
    "caseId": "081-21-45763",
    "caseTitle": "Sanchez Group",
    "chapter": "15",
    "courtName": "Southern District of New York",
    "courtDivisionName": "Manhattan",
    "regionId": "02",
    "orderType": "transfer",
    "orderDate": "2021-04-03",
    "sequenceNumber": 1,
    "documentNumber": 1,
    "summaryText": "Order Re: Transfer Case",
    "fullText": "Caritas volaticus voluptatem combibo degenero theatrum. Iste adeo versus pauci decimus. Impedit cubicularis odio crebro. Id desparatus adeptio accusamus vulnus adfectus. Terga conqueror sapiente clementia appello. Magni cum verecundia repellat speculum tantum. Absum iusto vespillo adicio. Attonbitus inflammatio collum copia adulescens bis.",
    "dateFiled": "2021-04-03",
    "documents": [
      {
        "fileUri": "https://en.wikipedia.org/api/rest_v1/page/pdf/0208-307899-1-1-0.pdf",
        "fileSize": 1514596,
        "fileLabel": "1",
        "fileExt": "pdf"
      }
    ],

    //
    // Originate from DXTR with default values. Mutated by the CAMS workflow lifecycle in Cosmos.
    //
    "status": "pending",
    "newCaseId": "23-50607"

    //
    // Originate from CAMS
    //

    * current in flight region/court/office? ==> start with "departing", end with "destination". use this for index?

    new court
    new region
    user
    timestamp

    * MAYBE need a change log.... __OR is this recorded to HISTORY/AUDIT collection??__ (yes)
      {
        start state
        end state
        user
        timestamp
        data: {
          ...changed attributes??
        }
      }

    //
    // meta
    //

    documentType: "transfer" // SAME AS orderType??

  }
  */
  public async syncOrders(context: ApplicationContext): Promise<void> {
    const initialSyncState = await this.runtimeRepo.getSyncState<OrderSyncState>(
      context,
      'ORDERS_SYNC_STATE',
    );
    const { txId } = initialSyncState;

    const { orders, maxTxId } = await this.ordersGateway.getOrderSync(context, txId);

    await this.ordersRepo.putOrders(context, orders);

    const finalSyncState = { ...initialSyncState, txId: maxTxId };

    await this.runtimeRepo.updateSyncState<OrderSyncState>(context, finalSyncState);
  }
}
