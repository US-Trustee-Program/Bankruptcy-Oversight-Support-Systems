import {
  OrderSyncState,
  OrdersGateway,
  OrdersRepository,
  RuntimeStateRepository,
} from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { Order, OrderTransfer } from './orders.model';
import { CamsError } from '../../common-errors/cams-error';

const MODULE_NAME = 'ORDERS_USE_CASE';

export interface SyncOrdersOptions {
  txIdOverride?: number;
}

export interface SyncOrdersStatus {
  options?: SyncOrdersOptions;
  initialSyncState: OrderSyncState;
  finalSyncState: OrderSyncState;
  length: number;
  startingTxId: number;
  maxTxId: number;
}

export class OrdersUseCase {
  private readonly ordersGateway: OrdersGateway;
  private readonly ordersRepo: OrdersRepository;
  private readonly runtimeStateRepo: RuntimeStateRepository;

  constructor(
    ordersRepo: OrdersRepository,
    ordersGateway: OrdersGateway,
    runtimeRepo: RuntimeStateRepository,
  ) {
    this.ordersRepo = ordersRepo;
    this.ordersGateway = ordersGateway;
    this.runtimeStateRepo = runtimeRepo;
  }

  public async getOrders(context: ApplicationContext): Promise<Array<Order>> {
    return this.ordersRepo.getOrders(context);
  }

  public async updateOrder(
    context: ApplicationContext,
    id: string,
    data: OrderTransfer,
  ): Promise<string> {
    return this.ordersRepo.updateOrder(context, id, data);
  }

  public async syncOrders(
    context: ApplicationContext,
    options: SyncOrdersOptions,
  ): Promise<SyncOrdersStatus> {
    let initialSyncState: OrderSyncState;

    try {
      initialSyncState = await this.runtimeStateRepo.getState<OrderSyncState>(
        context,
        'ORDERS_SYNC_STATE',
      );
      context.logger.info(
        MODULE_NAME,
        'Got initial runtime state from repo (Cosmos).',
        initialSyncState,
      );
    } catch (error) {
      context.logger.info(
        MODULE_NAME,
        'Failed to get initial runtime state from repo (Cosmos).',
        error,
      );
      if (options?.txIdOverride === undefined) {
        throw new CamsError(MODULE_NAME, {
          message: 'A transaction ID is required to seed the order sync run. Aborting.',
        });
      }
      if (error.message === 'Initial state was not found or was ambiguous.') {
        // const ustpSeedTxId = 167933444;
        initialSyncState = {
          documentType: 'ORDERS_SYNC_STATE',
          txId: options.txIdOverride,
        };
        initialSyncState = await this.runtimeStateRepo.createState(context, initialSyncState);
        context.logger.info(
          MODULE_NAME,
          'Wrote new runtime state to repo (Cosmos).',
          initialSyncState,
        );
      } else {
        throw error;
      }
    }

    const startingTxId = options?.txIdOverride ?? initialSyncState.txId;
    const { orders, maxTxId } = await this.ordersGateway.getOrderSync(context, startingTxId);
    context.logger.info(MODULE_NAME, 'Got orders from gateway (DXTR)', { maxTxId, orders });

    await this.ordersRepo.putOrders(context, orders);
    context.logger.info(MODULE_NAME, 'Put orders to repo (Cosmos)');

    const finalSyncState = { ...initialSyncState, txId: maxTxId };
    await this.runtimeStateRepo.updateState<OrderSyncState>(context, finalSyncState);
    context.logger.info(MODULE_NAME, 'Updated runtime state in repo (Cosmos)', finalSyncState);

    return {
      options,
      initialSyncState,
      finalSyncState,
      length: orders.length,
      startingTxId,
      maxTxId,
    };
  }
}
