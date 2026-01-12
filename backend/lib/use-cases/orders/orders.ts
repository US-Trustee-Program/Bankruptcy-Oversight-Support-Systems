import { OrderSyncState } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  ConsolidationOrderCase,
  ConsolidationType,
  generateConsolidationId,
  getCaseSummaryFromConsolidationOrderCase,
  getCaseSummaryFromTransferOrder,
  isTransferOrder,
  Order,
  OrderStatus,
  RawConsolidationOrder,
  TransferOrder,
  TransferOrderAction,
} from '@common/cams/orders';
import { ConsolidationFrom, ConsolidationTo, TransferFrom, TransferTo } from '@common/cams/events';
import { CaseSummary } from '@common/cams/cases';
import { CamsError } from '../../common-errors/cams-error';
import DateHelper from '@common/date-helper';
import {
  CaseConsolidationHistory,
  CaseHistory,
  ConsolidationOrderSummary,
  isConsolidationHistory,
} from '@common/cams/history';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsUserReference, getCourtDivisionCodes } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { createAuditRecord } from '@common/cams/auditable';
import { OrdersSearchPredicate } from '@common/api/search';
import { isNotFoundError } from '../../common-errors/not-found-error';
import Factory, { getCasesGateway } from '../../factory';

const MODULE_NAME = 'ORDERS-USE-CASE';

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

type HandleConsolidationParams = {
  context: ApplicationContext;
  status: OrderStatus;
  provisionalOrderId: string;
  includedCases: string[];
  consolidationType?: ConsolidationType;
  leadCase?: CaseSummary;
  reason?: string;
};

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
      .sort((a, b) => DateHelper.sortDates(a.orderDate, b.orderDate));
  }

  public async getSuggestedCases(context: ApplicationContext): Promise<Array<CaseSummary>> {
    const casesGateway = Factory.getCasesGateway(this.context);
    const { caseId } = context.request.params;
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

    const ordersRepo = Factory.getOrdersRepository(this.context);
    const casesRepo = Factory.getCasesRepository(this.context);

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

    const consolidationsByJobId = await this.mapConsolidations(context, consolidations);
    const writtenJobIds: number[] = [];
    for (const order of consolidationsByJobId.values()) {
      const count = await consolidationsRepo.count(order.consolidationId);
      if (count === 0) {
        const writtenConsolidation = await consolidationsRepo.create(order);
        writtenJobIds.push(writtenConsolidation.jobId);
      }
    }

    for (const order of consolidations) {
      if (writtenJobIds.includes(order.jobId)) {
        const history: ConsolidationOrderSummary = {
          status: 'pending',
          memberCases: [],
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
    const { approvedCases, leadCase, consolidationType, consolidationId } = data;
    return await this.handleConsolidation({
      context,
      status: 'approved',
      provisionalOrderId: consolidationId,
      includedCases: approvedCases,
      consolidationType,
      leadCase,
    });
  }

  public async rejectConsolidation(
    context: ApplicationContext,
    data: ConsolidationOrderActionRejection,
  ): Promise<ConsolidationOrder[]> {
    const { rejectedCases, consolidationId, reason } = data;
    return await this.handleConsolidation({
      context,
      status: 'rejected',
      provisionalOrderId: consolidationId,
      includedCases: rejectedCases,
      reason,
    });
  }

  private async buildHistory(
    context: ApplicationContext,
    bCase: CaseSummary,
    status: OrderStatus,
    memberCases: CaseSummary[],
    leadCase?: CaseSummary,
  ): Promise<CaseHistory> {
    const after: ConsolidationOrderSummary = {
      status,
      memberCases,
    };
    if (leadCase) {
      after.leadCase = leadCase;
    }
    let before;
    try {
      const casesRepo = Factory.getCasesRepository(context);
      const fullHistory = await casesRepo.getCaseHistory(bCase.caseId);
      before = fullHistory
        .filter((h) => h.documentType === 'AUDIT_CONSOLIDATION')
        .sort((a, b) => DateHelper.sortDatesReverse(a.updatedOn, b.updatedOn))
        .shift()?.after;
    } catch {
      before = undefined;
    }

    if (isConsolidationHistory(before) && before.memberCases.length > 0) {
      after.memberCases.push(...before.memberCases);
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
    params: HandleConsolidationParams,
  ): Promise<ConsolidationOrder[]> {
    const {
      context,
      status,
      provisionalOrderId,
      includedCases,
      consolidationType,
      leadCase,
      reason,
    } = params;

    if (!context.session.user.roles.includes(CamsRole.DataVerifier)) {
      throw new UnauthorizedError(MODULE_NAME);
    }

    if (
      status === 'approved' &&
      (includedCases.length === 0 ||
        (includedCases.length === 1 && includedCases[0] === leadCase.caseId))
    ) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Consolidation approvals require at least one member case.',
      });
    }

    const casesRepo = Factory.getCasesRepository(context);
    const consolidationsRepo = Factory.getConsolidationOrdersRepository(context);
    const provisionalOrder = await consolidationsRepo.read(provisionalOrderId);

    if (reason) {
      provisionalOrder.reason = reason;
    }

    const includedMemberCases = provisionalOrder.memberCases.filter((c) =>
      includedCases.includes(c.caseId),
    );
    const includedMemberCaseIds = includedMemberCases.map((bCase) => bCase.caseId);
    const additionalCaseIds = includedCases.filter(
      (bCase) => !includedMemberCaseIds.includes(bCase),
    );
    context.logger.debug(MODULE_NAME, 'Provisional order:', provisionalOrder);
    context.logger.debug(MODULE_NAME, 'Params:', { ...params, context: undefined });
    context.logger.debug(
      MODULE_NAME,
      `Provisional order included these case id's:`,
      includedMemberCaseIds,
    );
    context.logger.debug(MODULE_NAME, `Included case id's were:`, includedCases);

    const gateway = getCasesGateway(context);
    for (const caseId of additionalCaseIds) {
      const summary = await gateway.getCaseSummary(context, caseId);
      if (summary) {
        includedMemberCases.push({ ...summary, docketEntries: [], orderDate: '' });
      }
    }

    if (status === 'approved') {
      for (const caseId of includedCases) {
        const references = await casesRepo.getConsolidation(caseId);
        if (references.length > 0) {
          throw new BadRequestError(MODULE_NAME, {
            message: `Cannot consolidate order. A member case has already been consolidated.`,
          });
        }
      }
      const leadCaseReferences = await casesRepo.getConsolidation(leadCase.caseId);
      const isLeadCaseAMemberCase = leadCaseReferences
        .filter((reference) => reference.caseId === leadCase.caseId)
        .reduce((isMemberCase, reference) => {
          return isMemberCase || reference.documentType === 'CONSOLIDATION_TO';
        }, false);
      if (isLeadCaseAMemberCase) {
        throw new BadRequestError(MODULE_NAME, {
          message: `Cannot consolidate order. The lead case is a member case of another consolidation.`,
        });
      }
    }

    const filterMemberCasesOnThisOrder = (c: ConsolidationOrderCase) =>
      !includedCases.includes(c.caseId);
    const filterLeadCaseIfItExists = (c: ConsolidationOrderCase) =>
      !leadCase || c.caseId !== leadCase.caseId;

    const remainingMemberCases = provisionalOrder.memberCases
      .filter(filterMemberCasesOnThisOrder)
      .filter(filterLeadCaseIfItExists) as Array<ConsolidationOrderCase>;
    const response: Array<ConsolidationOrder> = [];
    const doSplit = remainingMemberCases.length > 0;
    const newConsolidation: ConsolidationOrder = {
      ...provisionalOrder,
      id: undefined,
      orderType: 'consolidation',
      consolidationId: undefined,
      consolidationType,
      status,
      memberCases: includedMemberCases,
      leadCase,
    };

    const count = await consolidationsRepo.count(
      generateConsolidationId(newConsolidation.jobId, newConsolidation.status),
    );
    newConsolidation.consolidationId = generateConsolidationId(
      newConsolidation.jobId,
      newConsolidation.status,
      count,
    );

    const createdConsolidation = await consolidationsRepo.create(newConsolidation);
    response.push(createdConsolidation as ConsolidationOrder);

    if (doSplit) {
      const remainingOrder = {
        ...provisionalOrder,
        consolidationType,
        memberCases: remainingMemberCases,
      };
      const updatedRemainingOrder = await consolidationsRepo.update(remainingOrder);
      response.push(updatedRemainingOrder as ConsolidationOrder);
    } else {
      await consolidationsRepo.delete(provisionalOrder.id);
    }

    for (const memberCase of newConsolidation.memberCases) {
      if (!leadCase || memberCase.caseId !== leadCase.caseId) {
        const caseHistory = await this.buildHistory(context, memberCase, status, [], leadCase);
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
        return { id: assignment.userId, name: assignment.name };
      });

      const memberCaseSummaries = [];
      for (const memberCase of newConsolidation.memberCases) {
        if (memberCase.caseId !== leadCase.caseId) {
          // Add the reference to the lead case to the member case.
          const consolidationTo: ConsolidationTo = {
            caseId: memberCase.caseId,
            otherCase: leadCase,
            orderDate: memberCase.orderDate,
            consolidationType: newConsolidation.consolidationType,
            documentType: 'CONSOLIDATION_TO',
            updatedBy: context.session.user,
            updatedOn: new Date().toISOString(),
          };
          await casesRepo.createConsolidationTo(consolidationTo);

          // Add the reference to the member case to the lead case.
          const consolidationFrom: ConsolidationFrom = {
            caseId: newConsolidation.leadCase.caseId,
            otherCase: getCaseSummaryFromConsolidationOrderCase(memberCase),
            orderDate: memberCase.orderDate,
            consolidationType: newConsolidation.consolidationType,
            documentType: 'CONSOLIDATION_FROM',
            updatedBy: context.session.user,
            updatedOn: new Date().toISOString(),
          };
          await casesRepo.createConsolidationFrom(consolidationFrom);

          // Assign lead case attorneys to the member case.
          await assignmentUseCase.createTrialAttorneyAssignments(
            context,
            memberCase.caseId,
            leadCaseAttorneys,
            CamsRole.TrialAttorney,
            { processRoles: [CamsRole.CaseAssignmentManager] },
          );

          // Add the member case lead case history.
          const memberCaseSummary = getCaseSummaryFromConsolidationOrderCase(memberCase);
          memberCaseSummaries.push(memberCaseSummary);
        }
      }

      // Add the lead case history.
      const leadCaseHistory = await this.buildHistory(
        context,
        leadCase,
        status,
        memberCaseSummaries,
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
      const consolidationId = generateConsolidationId(jobId, 'pending');
      const firstOrder = [...caseSummaries.values()].reduce((prior, next) => {
        if (!prior) {
          return next;
        }
        return DateHelper.sortDatesReverse(prior.orderDate, next.orderDate) <= 0 ? prior : next;
      }, null);
      const consolidationOrder: ConsolidationOrder = {
        consolidationId,
        orderType: 'consolidation',
        orderDate: firstOrder.orderDate,
        status: 'pending',
        courtDivisionCode: firstOrder.courtDivisionCode,
        courtName: firstOrder.courtName,
        jobId,
        memberCases: Array.from(jobToCaseMap.get(jobId).values()),
      };
      consolidationsByJobId.set(jobId, consolidationOrder);
    });
    return consolidationsByJobId;
  }
}
