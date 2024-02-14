import {
  OrderSyncState,
  OrdersGateway,
  OrdersRepository,
  RuntimeStateRepository,
  CasesRepository,
} from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  ConsolidationOrder,
  TransferOrder,
  TransferOrderAction,
} from '../../../../../common/src/cams/orders';
import { TransferIn, TransferOut } from '../../../../../common/src/cams/events';
import { CaseDetail, CaseSummary } from '../../../../../common/src/cams/cases';
import { CasesInterface } from '../cases.interface';
import { CaseHistory } from '../../adapters/types/case.history';
import { CamsError } from '../../common-errors/cams-error';

const MODULE_NAME = 'ORDERS_USE_CASE';

export interface SyncOrdersOptions {
  txIdOverride?: string;
}

export interface SyncOrdersStatus {
  options?: SyncOrdersOptions;
  initialSyncState: OrderSyncState;
  finalSyncState: OrderSyncState;
  length: number;
  startingTxId: string;
  maxTxId: string;
}

export class OrdersUseCase {
  private readonly casesRepo: CasesRepository;
  private readonly casesGateway: CasesInterface;
  private readonly ordersGateway: OrdersGateway;
  private readonly ordersRepo: OrdersRepository;
  private readonly runtimeStateRepo: RuntimeStateRepository;

  constructor(
    casesRepo: CasesRepository,
    casesGateway: CasesInterface,
    ordersRepo: OrdersRepository,
    ordersGateway: OrdersGateway,
    runtimeRepo: RuntimeStateRepository,
  ) {
    this.casesRepo = casesRepo;
    this.casesGateway = casesGateway;
    this.ordersRepo = ordersRepo;
    this.ordersGateway = ordersGateway;
    this.runtimeStateRepo = runtimeRepo;
  }

  public async getOrders(
    context: ApplicationContext,
  ): Promise<Array<TransferOrder | ConsolidationOrder>> {
    return this.ordersRepo.getOrders(context);
  }

  public async getSuggestedCases(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<CaseDetail>> {
    return this.casesGateway.getSuggestedCases(context, caseId);
  }

  public async updateOrder(
    context: ApplicationContext,
    id: string,
    data: TransferOrderAction,
  ): Promise<string> {
    const initialOrder = await this.ordersRepo.getOrder(context, id, data.caseId);
    await this.ordersRepo.updateOrder(context, id, data);
    const order = await this.ordersRepo.getOrder(context, id, data.caseId);

    if (order.orderType === 'transfer') {
      if (order.status === 'approved') {
        const transferIn: TransferIn = {
          caseId: order.newCaseId,
          otherCaseId: order.caseId,
          divisionName: order.courtDivisionName,
          courtName: order.courtName,
          orderDate: order.orderDate,
          documentType: 'TRANSFER_IN',
        };

        const transferOut: TransferOut = {
          caseId: order.caseId,
          otherCaseId: order.newCase.caseId,
          divisionName: order.newCase.courtDivisionName,
          courtName: order.newCase.courtName,
          orderDate: order.orderDate,
          documentType: 'TRANSFER_OUT',
        };

        await this.casesRepo.createTransferIn(context, transferIn);
        await this.casesRepo.createTransferOut(context, transferOut);
      }
      const caseHistory: CaseHistory = {
        caseId: order.caseId,
        documentType: 'AUDIT_TRANSFER',
        before: initialOrder as TransferOrder,
        after: order,
      };
      await this.casesRepo.createCaseHistory(context, caseHistory);
    }

    return id;
  }

  public async syncOrders(
    context: ApplicationContext,
    options?: SyncOrdersOptions,
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
      if (error.message === 'Initial state was not found or was ambiguous.') {
        if (options?.txIdOverride === undefined) {
          throw new CamsError(MODULE_NAME, {
            message: 'A transaction ID is required to seed the order sync run. Aborting.',
          });
        }
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
    const { consolidations, transfers, maxTxId } = await this.ordersGateway.getOrderSync(
      context,
      startingTxId,
    );
    context.logger.info(MODULE_NAME, 'Got orders from gateway (DXTR)', {
      maxTxId,
      transfers,
      consolidations,
    });

    const writtenTransfers = await this.ordersRepo.putOrders(context, transfers);
    context.logger.info(MODULE_NAME, 'Put orders to repo (Cosmos)');

    for (const order of writtenTransfers) {
      if (order.orderType === 'transfer') {
        const caseHistory: CaseHistory = {
          caseId: order.caseId,
          documentType: 'AUDIT_TRANSFER',
          before: null,
          after: order,
        };
        await this.casesRepo.createCaseHistory(context, caseHistory);
      }
    }

    const jobIds: Set<number> = new Set();
    consolidations.forEach((consolidation) => {
      jobIds.add(consolidation.jobId);
    });

    const consolidationsByJobId = await this.mapConsolidations(jobIds, consolidations, context);

    const writtenConsolidations = await this.ordersRepo.putOrders(
      context,
      Array.from(consolidationsByJobId.values()),
    );
    context.logger.info(MODULE_NAME, 'Consolidations Written to Cosmos: ', writtenConsolidations);

    // TODO: create AUDIT_HISTORY for consolidations

    const finalSyncState = { ...initialSyncState, txId: maxTxId };
    await this.runtimeStateRepo.updateState<OrderSyncState>(context, finalSyncState);
    context.logger.info(MODULE_NAME, 'Updated runtime state in repo (Cosmos)', finalSyncState);

    return {
      options,
      initialSyncState,
      finalSyncState,
      length: transfers.length + Array.from(consolidationsByJobId.values()).length,
      startingTxId,
      maxTxId,
    };
  }

  public async mapConsolidations(
    jobIds: Set<number>,
    consolidations: ConsolidationOrder[],
    context: ApplicationContext,
  ): Promise<Map<number, ConsolidationOrder>> {
    const consolidationsByJobId: Map<number, ConsolidationOrder> = new Map();
    for (const jobId of jobIds) {
      const listOfOrders = consolidations.filter((consolidation) => {
        return consolidation.jobId === jobId;
      });
      const caseSummaryMap: Map<string, CaseSummary> = new Map();
      for (const order of listOfOrders) {
        const subjectCase = `${order.caseId}`;
        console.log('Subject Case: ', subjectCase);
        const leadCase = order.leadCase ? `${order.divisionCode}-${order.leadCase}` : undefined;
        console.log('Lead Case: ', leadCase);
        if (!caseSummaryMap.has(subjectCase)) {
          try {
            caseSummaryMap.set(
              subjectCase,
              await this.casesGateway.getCaseSummary(context, subjectCase),
            );
          } catch (e) {
            // do nothing
          }
        }
        if (leadCase && !caseSummaryMap.has(leadCase)) {
          try {
            caseSummaryMap.set(leadCase, await this.casesGateway.getCaseSummary(context, leadCase));
          } catch (e) {
            // do nothing
          }
        }
      }
      const parent: ConsolidationOrder = {
        ...listOfOrders[0],
        childCases: Array.from(caseSummaryMap.values()),
      };
      consolidationsByJobId.set(jobId, parent);
    }
    console.log(' Consolidations by JobId: ', consolidationsByJobId);

    return consolidationsByJobId;
  }
}
