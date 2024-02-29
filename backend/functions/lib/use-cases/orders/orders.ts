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
  Order,
  ConsolidationOrderActionRejection,
  ConsolidationHistory,
  OrderStatus,
  ConsolidationOrderActionApproval,
  TransferOrderAction,
} from '../../../../../common/src/cams/orders';
import { TransferIn, TransferOut } from '../../../../../common/src/cams/events';
import { CaseSummary } from '../../../../../common/src/cams/cases';
import { CasesInterface } from '../cases.interface';
import { CaseHistory } from '../../adapters/types/case.history';
import { CamsError } from '../../common-errors/cams-error';
import ConsolidationOrdersCosmosDbRepository from '../../adapters/gateways/consolidations.cosmosdb.repository';
import { sortDates, sortDatesReverse } from '../../../../../common/src/date-helper';
import { isConsolidationHistory } from '../../../../../common/src/cams/orders';
import * as crypto from 'crypto';
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

  public async getOrders(context: ApplicationContext): Promise<Array<Order>> {
    const transferOrders = await this.ordersRepo.getOrders(context);
    const consolidationOrders = await this.consolidationsRepo.getAll(context);
    return transferOrders
      .concat(consolidationOrders)
      .sort((a, b) => sortDates(a.orderDate, b.orderDate));
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
    data: TransferOrderAction,
  ): Promise<string> {
    const initialOrder = await this.ordersRepo.getOrder(context, id, data.caseId);
    let order: Order;
    if (isTransferOrder(initialOrder)) {
      await this.ordersRepo.updateOrder(context, id, data);
      order = await this.ordersRepo.getOrder(context, id, data.caseId);
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

    const writtenTransfers = await this.ordersRepo.putOrders(context, transfers);

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

    await this.consolidationsRepo.putAll(context, Array.from(consolidationsByJobId.values()));

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

  public async approveConsolidation(
    context: ApplicationContext,
    data: ConsolidationOrderActionApproval,
  ): Promise<ConsolidationOrder[]> {
    const { approvedCases, leadCase, ...provisionalOrder } = data;
    return await this.handleConsolidation(
      context,
      'approved',
      provisionalOrder,
      approvedCases,
      leadCase,
    );
  }

  public async rejectConsolidation(
    context: ApplicationContext,
    data: ConsolidationOrderActionRejection,
  ): Promise<ConsolidationOrder[]> {
    // TODO CAMS-270
    // - valid case id supplied (Noticed a reject record got created when passing a list of invalid string values)

    const { rejectedCases, ...provisionalOrder } = data;
    return await this.handleConsolidation(context, 'rejected', provisionalOrder, rejectedCases);
  }

  private async handleConsolidation(
    context: ApplicationContext,
    status: OrderStatus,
    provisionalOrder: ConsolidationOrder,
    includedCases: string[],
    leadCase?: ConsolidationOrderCase,
  ): Promise<ConsolidationOrder[]> {
    const includedChildCases = provisionalOrder.childCases.filter((c) =>
      includedCases.includes(c.caseId),
    );
    const remainingChildCases = provisionalOrder.childCases.filter(
      (c) => !includedCases.includes(c.caseId),
    );
    const response: Array<ConsolidationOrder> = [];
    const doSplit = remainingChildCases.length > 0;
    const newConsolidation: ConsolidationOrder = {
      ...provisionalOrder,
      id: undefined,
      consolidationId: crypto.randomUUID(),
      status,
      childCases: includedChildCases,
      leadCase,
    };
    if (doSplit) {
      provisionalOrder.childCases = remainingChildCases;
      await this.consolidationsRepo.update(
        context,
        provisionalOrder.id,
        provisionalOrder.consolidationId,
        provisionalOrder,
      );
      response.push(provisionalOrder);
    } else {
      // TODO: Do we want to consider a soft delete or just a status change?
      await this.consolidationsRepo.delete(
        context,
        provisionalOrder.id,
        provisionalOrder.consolidationId,
      );
      //somehow signal this was a deletion
      response.push(provisionalOrder);
    }
    const createdConsolidation = await this.consolidationsRepo.put(context, newConsolidation);
    response.push(createdConsolidation);
    for (const childCase of newConsolidation.childCases) {
      const history: ConsolidationHistory = {
        status,
        childCases: [],
      };
      const fullHistory = await this.casesRepo.getCaseHistory(context, childCase.caseId);
      const before = fullHistory
        .filter((h) => h.documentType === 'AUDIT_CONSOLIDATION')
        .sort((a, b) => sortDatesReverse(a.occurredAtTimestamp, b.occurredAtTimestamp))
        .shift()?.after;

      const caseHistory: CaseHistory = {
        caseId: childCase.caseId,
        documentType: 'AUDIT_CONSOLIDATION',
        before: isConsolidationHistory(before) ? before : undefined,
        after: history,
      };
      await this.casesRepo.createCaseHistory(context, caseHistory);
    }
    return response;
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

    jobToCaseMap.forEach((caseSummaries, jobId) => {
      const consolidationId = crypto.randomUUID();
      const firstOrder = caseSummaries.values().next()?.value;
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
