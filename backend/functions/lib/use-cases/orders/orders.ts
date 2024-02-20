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
  ConsolidationOrderCase,
  RawConsolidationOrder,
  TransferOrder,
  isTransferOrder,
  OrderAction,
  Order,
  ConsolidationOrderActionRejection,
  ConsolidationHistory,
} from '../../../../../common/src/cams/orders';
import { TransferIn, TransferOut } from '../../../../../common/src/cams/events';
import { CaseSummary } from '../../../../../common/src/cams/cases';
import { CasesInterface } from '../cases.interface';
import { CaseHistory } from '../../adapters/types/case.history';
import { CamsError } from '../../common-errors/cams-error';
import { ConsolidationOrdersCosmosDbRepository } from '../../adapters/gateways/consolidations.cosmosdb.repository';

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
  private readonly consolidationsRepo: ConsolidationOrdersCosmosDbRepository;
  private readonly runtimeStateRepo: RuntimeStateRepository;

  constructor(
    casesRepo: CasesRepository,
    casesGateway: CasesInterface,
    ordersRepo: OrdersRepository,
    ordersGateway: OrdersGateway,
    runtimeRepo: RuntimeStateRepository,
    consolidationRepo: ConsolidationOrdersCosmosDbRepository,
  ) {
    this.casesRepo = casesRepo;
    this.casesGateway = casesGateway;
    this.ordersRepo = ordersRepo;
    this.ordersGateway = ordersGateway;
    this.runtimeStateRepo = runtimeRepo;
    this.consolidationsRepo = consolidationRepo;
  }

  public async getOrders(
    context: ApplicationContext,
  ): Promise<Array<TransferOrder | ConsolidationOrder>> {
    return this.ordersRepo.getOrders(context);
  }

  public async getSuggestedCases(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Array<CaseSummary>> {
    return this.casesGateway.getSuggestedCases(context, caseId);
  }

  public async updateTransferOrder(
    context: ApplicationContext,
    id: string,
    data: OrderAction<TransferOrder>,
  ): Promise<string> {
    const initialOrder = await this.ordersRepo.getOrder(context, id, data.order.caseId);
    let order: Order;
    if (isTransferOrder(data.order)) {
      await this.ordersRepo.updateOrder(context, id, data);
      order = await this.ordersRepo.getOrder(context, id, data.order.caseId);
    }

    if (isTransferOrder(order)) {
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
      if (isTransferOrder(order)) {
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

    const consolidationsByJobId = await this.mapConsolidations(context, consolidations);

    const writtenConsolidations = await this.consolidationsRepo.putOrders(
      context,
      Array.from(consolidationsByJobId.values()),
    );
    context.logger.info(MODULE_NAME, 'Consolidations Written to Cosmos: ', writtenConsolidations);

    for (const order of consolidations) {
      const history: ConsolidationHistory = {
        status: 'pending',
        childCases: [],
      };
      const caseHistory: CaseHistory = {
        caseId: order.caseId,
        documentType: 'AUDIT_CONSOLIDATION',
        before: null,
        after: history,
      };
      await this.casesRepo.createCaseHistory(context, caseHistory);
    }

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

  public async rejectConsolidation(
    context: ApplicationContext,
    data: ConsolidationOrderActionRejection,
  ) {
    // TODO: implement and define type for `data`

    // TODO: move this stuff into use case
    // UPDATE existing "pending" consolidation order [orders]
    // ADD "reject" consolidation order [orders]

    // WHAT DO WE NEED FROM REQ

    const { rejectedCases, ...originalOrder } = data;
    const rejectedChildCases = data.childCases.filter((c) => rejectedCases.includes(c.caseId));
    const remainingChildCases = data.childCases.filter((c) => !rejectedCases.includes(c.caseId));

    const doSplit = !remainingChildCases.length;
    if (doSplit) {
      originalOrder.childCases = remainingChildCases;
    } else {
      originalOrder.status = 'rejected';
      originalOrder.childCases = rejectedChildCases;
    }

    // persist the originalConsolidationOrder to cosmos
    this.consolidationsRepo.update(context, originalOrder.id, originalOrder);

    if (doSplit) {
      const rejectConsolidation: ConsolidationOrder = {
        consolidationId: 'tbd',
        orderType: 'consolidation',
        status: 'rejected',
        orderDate: data.orderDate,
        docketEntries: data.docketEntries,
        courtName: data.courtName,
        divisionCode: data.divisionCode,
        jobId: data.jobId,
        childCases: rejectedChildCases,
      };
      this.consolidationsRepo.put(context, rejectConsolidation);
    }

    // UPDATE the case detail history for list of reject cases [cases] with document type AUDIT_CONSOLIDATION
  }

  public async mapConsolidations(
    context: ApplicationContext,
    consolidations: RawConsolidationOrder[],
  ): Promise<Map<number, ConsolidationOrder>> {
    const consolidationsByJobId: Map<number, ConsolidationOrder> = new Map();

    const notFound = new Set<string>();
    const jobToCaseMap = new Map<number, Map<string, ConsolidationOrderCase>>();
    for (const order of consolidations) {
      if (!jobToCaseMap.has(order.jobId)) {
        jobToCaseMap.set(order.jobId, new Map<string, ConsolidationOrderCase>());
      }
      const caseMap = jobToCaseMap.get(order.jobId);
      caseMap.set(order.caseId, order);

      const maybeLeadCaseId = order.leadCaseIdHint ?? undefined;
      if (maybeLeadCaseId && !caseMap.has(maybeLeadCaseId) && !notFound.has(maybeLeadCaseId)) {
        try {
          const maybeLeadCase = await this.casesGateway.getCaseSummary(context, maybeLeadCaseId);
          // TODO: we need something that has docket entries
          if (maybeLeadCase) {
            caseMap.set(maybeLeadCaseId, {
              ...maybeLeadCase,
              docketEntries: [],
            });
          }
        } catch {
          notFound.add(maybeLeadCaseId);
        }
      }
    }

    const consolidationId = crypto.randomUUID();

    jobToCaseMap.forEach((caseSummaries, jobId) => {
      const firstOrder = caseSummaries.values().next().value;
      const consolidationOrder: ConsolidationOrder = {
        consolidationId,
        orderType: 'consolidation',
        orderDate: firstOrder.orderDate,
        status: 'pending',
        docketEntries: firstOrder.docketEntries,
        divisionCode: firstOrder.divisionCode,
        courtName: firstOrder.courtName,
        jobId,
        childCases: Array.from(jobToCaseMap.get(jobId).values()),
      };
      consolidationsByJobId.set(jobId, consolidationOrder);
    });

    return consolidationsByJobId;
  }
}
