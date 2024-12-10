import { OrderSyncState } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  ConsolidationOrder,
  ConsolidationOrderCase,
  RawConsolidationOrder,
  TransferOrder,
  isTransferOrder,
  Order,
  ConsolidationOrderActionRejection,
  OrderStatus,
  ConsolidationOrderActionApproval,
  TransferOrderAction,
  ConsolidationType,
  getCaseSummaryFromTransferOrder,
  getCaseSummaryFromConsolidationOrderCase,
} from '../../../../common/src/cams/orders';
import {
  ConsolidationFrom,
  ConsolidationTo,
  TransferFrom,
  TransferTo,
} from '../../../../common/src/cams/events';
import { CaseSummary } from '../../../../common/src/cams/cases';
import { CamsError } from '../../common-errors/cams-error';
import { sortDates, sortDatesReverse } from '../../../../common/src/date-helper';
import * as crypto from 'crypto';
import {
  CaseConsolidationHistory,
  CaseHistory,
  ConsolidationOrderSummary,
  isConsolidationHistory,
} from '../../../../common/src/cams/history';
import { CaseAssignmentUseCase } from '../case-assignment';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsUserReference, getCourtDivisionCodes } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { createAuditRecord } from '../../../../common/src/cams/auditable';
import { OrdersSearchPredicate } from '../../../../common/src/api/search';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { Factory } from '../../factory';

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
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  public async getOrders(context: ApplicationContext): Promise<Array<Order>> {
    const ordersRepo = Factory.getOrdersRepository(this.context);
    const consolidationsRepo = Factory.getConsolidationOrdersRepository(this.context);

    let predicate: OrdersSearchPredicate = undefined;
    if (context.session) {
      const divisionCodes = getCourtDivisionCodes(context.session.user);
      predicate = { divisionCodes };
    }
    const transferOrders = await ordersRepo.search(predicate);
    const consolidationOrders = await consolidationsRepo.search(predicate);

    return transferOrders
      .concat(consolidationOrders)
      .sort((a, b) => sortDates(a.orderDate, b.orderDate));
  }

  public async getSuggestedCases(context: ApplicationContext): Promise<Array<CaseSummary>> {
    const casesGateway = Factory.getCasesGateway(this.context);
    const caseId = context.request.params.caseId;
    return casesGateway.getSuggestedCases(context, caseId);
  }

  public async updateTransferOrder(
    context: ApplicationContext,
    id: string,
    data: TransferOrderAction,
  ): Promise<void> {
    if (!context.session.user.roles.includes(CamsRole.DataVerifier)) {
      throw new UnauthorizedError(MODULE_NAME);
    }

    const storageGateway = Factory.getStorageGateway(this.context);
    const ordersRepo = Factory.getOrdersRepository(this.context);
    const casesRepo = Factory.getCasesRepository(this.context);

    const divisionMeta = storageGateway.getUstpDivisionMeta();
    const divisionCodeMaybe = data['newCase'] ? data['newCase'].courtDivisionCode : null;
    if (
      divisionCodeMaybe &&
      divisionMeta.has(divisionCodeMaybe) &&
      divisionMeta.get(divisionCodeMaybe).isLegacy
    ) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Cannot transfer to legacy division.',
      });
    }

    context.logger.info(MODULE_NAME, 'Updating transfer order:', data);
    const initialOrder = await ordersRepo.read(id, data.caseId);
    let order: Order;
    if (isTransferOrder(initialOrder)) {
      await ordersRepo.update(data);
      order = await ordersRepo.read(id, data.caseId);
    }
    if (isTransferOrder(order)) {
      if (order.status === 'approved') {
        const transferFrom: TransferFrom = {
          caseId: order.newCase.caseId,
          otherCase: getCaseSummaryFromTransferOrder(order),
          orderDate: order.orderDate,
          documentType: 'TRANSFER_FROM',
        };

        const transferTo: TransferTo = {
          caseId: order.caseId,
          otherCase: order.newCase,
          orderDate: order.orderDate,
          documentType: 'TRANSFER_TO',
        };

        await casesRepo.createTransferFrom(transferFrom);
        await casesRepo.createTransferTo(transferTo);
      }
      const caseHistory = createAuditRecord<CaseHistory>(
        {
          caseId: order.caseId,
          documentType: 'AUDIT_TRANSFER',
          before: initialOrder as TransferOrder,
          after: order,
        },
        context.session?.user,
      );
      await casesRepo.createCaseHistory(caseHistory);
    }
  }

  public async syncOrders(
    context: ApplicationContext,
    options?: SyncOrdersOptions,
  ): Promise<SyncOrdersStatus> {
    let initialSyncState: OrderSyncState;
    const runtimeStateRepo = Factory.getOrderSyncStateRepo(context);
    const ordersGateway = Factory.getOrdersGateway(context);
    const ordersRepo = Factory.getOrdersRepository(context);
    const casesRepo = Factory.getCasesRepository(context);
    const consolidationsRepo = Factory.getConsolidationOrdersRepository(context);

    try {
      initialSyncState = await runtimeStateRepo.read('ORDERS_SYNC_STATE', '');
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
      if (isNotFoundError(error)) {
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
        initialSyncState = await runtimeStateRepo.upsert(initialSyncState);
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
    const { consolidations, transfers, maxTxId } = await ordersGateway.getOrderSync(
      context,
      startingTxId,
    );

    const writtenTransfers = await ordersRepo.createMany(transfers);

    for (const order of writtenTransfers) {
      if (isTransferOrder(order)) {
        const caseHistory = createAuditRecord<CaseHistory>(
          {
            caseId: order.caseId,
            documentType: 'AUDIT_TRANSFER',
            before: null,
            after: order,
          },
          context.session?.user,
        );
        await casesRepo.createCaseHistory(caseHistory);
      }
    }

    const jobIds: Set<number> = new Set();
    consolidations.forEach((consolidation) => {
      jobIds.add(consolidation.jobId);
    });
    const consolidationsByJobId = await this.mapConsolidations(context, consolidations);

    await consolidationsRepo.createMany(Array.from(consolidationsByJobId.values()));

    for (const order of consolidations) {
      const history: ConsolidationOrderSummary = {
        status: 'pending',
        childCases: [],
      };
      const caseHistory = createAuditRecord<CaseHistory>(
        {
          caseId: order.caseId,
          documentType: 'AUDIT_CONSOLIDATION',
          before: null,
          after: history,
        },
        context.session?.user,
      );
      await casesRepo.createCaseHistory(caseHistory);
    }

    const finalSyncState = { ...initialSyncState, txId: maxTxId };
    await runtimeStateRepo.upsert(finalSyncState);
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
      data.consolidationType,
      leadCase,
    );
  }

  public async rejectConsolidation(
    context: ApplicationContext,
    data: ConsolidationOrderActionRejection,
  ): Promise<ConsolidationOrder[]> {
    const { rejectedCases, ...provisionalOrder } = data;
    return await this.handleConsolidation(context, 'rejected', provisionalOrder, rejectedCases);
  }

  private async buildHistory(
    context: ApplicationContext,
    bCase: CaseSummary,
    status: OrderStatus,
    childCases: CaseSummary[],
    leadCase?: CaseSummary,
  ): Promise<CaseHistory> {
    const after: ConsolidationOrderSummary = {
      status,
      childCases,
    };
    if (leadCase) after.leadCase = leadCase;
    let before;
    try {
      const casesRepo = Factory.getCasesRepository(context);
      const fullHistory = await casesRepo.getCaseHistory(bCase.caseId);
      before = fullHistory
        .filter((h) => h.documentType === 'AUDIT_CONSOLIDATION')
        .sort((a, b) => sortDatesReverse(a.updatedOn, b.updatedOn))
        .shift()?.after;
    } catch {
      before = undefined;
    }

    if (isConsolidationHistory(before) && before.childCases.length > 0) {
      after.childCases.push(...before.childCases);
    }
    return createAuditRecord<CaseConsolidationHistory>(
      {
        caseId: bCase.caseId,
        documentType: 'AUDIT_CONSOLIDATION',
        before: isConsolidationHistory(before) ? before : null,
        after,
      },
      context.session?.user,
    );
  }

  private async handleConsolidation(
    context: ApplicationContext,
    status: OrderStatus,
    provisionalOrder: ConsolidationOrder,
    includedCases: string[],
    consolidationType?: ConsolidationType,
    leadCase?: CaseSummary,
  ): Promise<ConsolidationOrder[]> {
    if (!context.session.user.roles.includes(CamsRole.DataVerifier)) {
      throw new UnauthorizedError(MODULE_NAME);
    }

    const includedChildCases = provisionalOrder.childCases.filter((c) =>
      includedCases.includes(c.caseId),
    );

    const casesRepo = Factory.getCasesRepository(context);
    const consolidationsRepo = Factory.getConsolidationOrdersRepository(context);
    if (status === 'approved') {
      for (const caseId of includedCases) {
        const references = await casesRepo.getConsolidation(caseId);
        if (references.length > 0) {
          throw new BadRequestError(MODULE_NAME, {
            message: `Cannot consolidate order. A child case has already been consolidated.`,
          });
        }
      }
      const leadCaseReferences = await casesRepo.getConsolidation(leadCase.caseId);
      const isLeadCaseAChildCase = leadCaseReferences
        .filter((reference) => reference.caseId === leadCase.caseId)
        .reduce((isChildCase, reference) => {
          return isChildCase || reference.documentType === 'CONSOLIDATION_TO';
        }, false);
      if (isLeadCaseAChildCase) {
        throw new BadRequestError(MODULE_NAME, {
          message: `Cannot consolidate order. The lead case is a child case of another consolidation.`,
        });
      }
    }

    const remainingChildCases = provisionalOrder.childCases.filter(
      (c) => !includedCases.includes(c.caseId),
    );
    const response: Array<ConsolidationOrder> = [];
    const doSplit = remainingChildCases.length > 0;
    const newConsolidation: ConsolidationOrder = {
      ...provisionalOrder,
      id: undefined,
      orderType: 'consolidation',
      consolidationId: crypto.randomUUID(),
      consolidationType,
      status,
      childCases: includedChildCases,
      leadCase,
    };

    if (doSplit) {
      const remainingOrder = {
        ...provisionalOrder,
        consolidationType,
        childCases: remainingChildCases,
        id: undefined,
      };
      const updatedRemainingOrder = await consolidationsRepo.create(remainingOrder);
      response.push(updatedRemainingOrder as ConsolidationOrder);
    }

    await consolidationsRepo.delete(provisionalOrder.id);

    const createdConsolidation = await consolidationsRepo.create(newConsolidation);
    response.push(createdConsolidation as ConsolidationOrder);

    for (const childCase of newConsolidation.childCases) {
      if (!leadCase || childCase.caseId !== leadCase.caseId) {
        const caseHistory = await this.buildHistory(context, childCase, status, [], leadCase);
        await casesRepo.createCaseHistory(caseHistory);
      }
    }

    if (status === 'approved') {
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      const leadCaseAssignmentsMap = await assignmentUseCase.findAssignmentsByCaseId([
        leadCase.caseId,
      ]);
      const leadCaseAssignments = leadCaseAssignmentsMap.get(leadCase.caseId) ?? [];
      const leadCaseAttorneys: CamsUserReference[] = leadCaseAssignments.map((assignment) => {
        return { id: assignment.caseId, name: assignment.name };
      });

      const childCaseSummaries = [];
      for (const childCase of newConsolidation.childCases) {
        if (childCase.caseId !== leadCase.caseId) {
          // Add the reference to the lead case to the child case.
          const consolidationTo: ConsolidationTo = {
            caseId: childCase.caseId,
            otherCase: leadCase,
            orderDate: childCase.orderDate,
            consolidationType: newConsolidation.consolidationType,
            documentType: 'CONSOLIDATION_TO',
          };
          await casesRepo.createConsolidationTo(consolidationTo);

          // Add the reference to the child case to the lead case.
          const consolidationFrom: ConsolidationFrom = {
            caseId: newConsolidation.leadCase.caseId,
            otherCase: getCaseSummaryFromConsolidationOrderCase(childCase),
            orderDate: childCase.orderDate,
            consolidationType: newConsolidation.consolidationType,
            documentType: 'CONSOLIDATION_FROM',
          };
          await casesRepo.createConsolidationFrom(consolidationFrom);

          // Assign lead case attorneys to the child case.
          await assignmentUseCase.createTrialAttorneyAssignments(
            context,
            childCase.caseId,
            leadCaseAttorneys,
            'TrialAttorney',
            { processRoles: [CamsRole.CaseAssignmentManager] },
          );

          // Add the child case lead case history.
          const childCaseSummary = getCaseSummaryFromConsolidationOrderCase(childCase);
          childCaseSummaries.push(childCaseSummary);
        }
      }

      // Add the lead case history.
      const leadCaseHistory = await this.buildHistory(
        context,
        leadCase,
        status,
        childCaseSummaries,
      );
      await casesRepo.createCaseHistory(leadCaseHistory);
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
          const casesGateway = Factory.getCasesGateway(context);
          const maybeLeadCase = await casesGateway.getCaseSummary(context, maybeLeadCaseId);
          if (maybeLeadCase) {
            caseMap.set(maybeLeadCaseId, {
              ...maybeLeadCase,
              orderDate: order.orderDate,
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
      // TODO: Maybe grab the earliest date from all the case summaries, rather than just the first one.
      const firstOrder = caseSummaries.values().next()?.value;
      const consolidationOrder: ConsolidationOrder = {
        consolidationId,
        consolidationType: firstOrder.consolidationType,
        orderType: 'consolidation',
        orderDate: firstOrder.orderDate,
        status: 'pending',
        courtDivisionCode: firstOrder.courtDivisionCode,
        courtName: firstOrder.courtName,
        jobId,
        childCases: Array.from(jobToCaseMap.get(jobId).values()),
      };
      consolidationsByJobId.set(jobId, consolidationOrder);
    });
    return consolidationsByJobId;
  }
}