import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import { MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import {
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
  getCasesRepository,
  getCasesGateway,
  getConsolidationOrdersRepository,
} from '../../factory';
import { OrdersCosmosDbRepository } from '../../adapters/gateways/orders.cosmosdb.repository';
import { RuntimeStateCosmosDbRepository } from '../../adapters/gateways/runtime-state.cosmosdb.repository';
import { MockOrdersGateway } from '../../adapters/gateways/dxtr/mock.orders.gateway';
import { OrderSyncState } from '../gateways.types';
import { CamsError } from '../../common-errors/cams-error';
import {
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  getCaseSummaryFromConsolidationOrderCase,
  getCaseSummaryFromTransferOrder,
  TransferOrder,
  TransferOrderAction,
} from '../../../../../common/src/cams/orders';
import { TransferFrom, TransferTo } from '../../../../../common/src/cams/events';
import { CASE_SUMMARIES } from '../../testing/mock-data/case-summaries.mock';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { CasesLocalGateway } from '../../adapters/gateways/mock.cases.gateway';
import { CaseSummary } from '../../../../../common/src/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { NotFoundError } from '../../common-errors/not-found-error';
import { sortDates } from '../../../../../common/src/date-helper';
import { CosmosDbRepository } from '../../adapters/gateways/cosmos/cosmos.repository';
import { CasesCosmosDbRepository } from '../../adapters/gateways/cases.cosmosdb.repository';
import * as crypto from 'crypto';
import { CaseHistory, ConsolidationOrderSummary } from '../../../../../common/src/cams/history';
import { CaseAssignmentUseCase } from '../case.assignment';

describe('Orders use case', () => {
  const CASE_ID = '000-11-22222';
  let mockContext;
  let ordersGateway;
  let ordersRepo;
  let casesRepo;
  let runtimeStateRepo;
  let casesGateway;
  let consolidationRepo;
  let useCase: OrdersUseCase;

  beforeEach(async () => {
    mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    ordersGateway = getOrdersGateway(mockContext);
    runtimeStateRepo = getRuntimeStateRepository(mockContext);
    ordersRepo = getOrdersRepository(mockContext);
    casesRepo = getCasesRepository(mockContext);
    casesGateway = getCasesGateway(mockContext);
    consolidationRepo = getConsolidationOrdersRepository(mockContext);
    useCase = new OrdersUseCase(
      casesRepo,
      casesGateway,
      ordersRepo,
      ordersGateway,
      runtimeStateRepo,
      consolidationRepo,
    );
  });

  test('should return list of orders for the API from the repo', async () => {
    const mockOrders = [MockData.getTransferOrder(), MockData.getConsolidationOrder()].sort(
      (a, b) => sortDates(a.orderDate, b.orderDate),
    );
    const mockRead = jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValueOnce({
      resources: mockOrders,
    });
    const result = await useCase.getOrders(mockContext);
    expect(result).toEqual(mockOrders);
    expect(mockRead).toHaveBeenCalled();
  });

  test('should return list of suggested cases for an order', async () => {
    const suggestedCases = [CASE_SUMMARIES[0]];
    const gateway = jest.spyOn(casesGateway, 'getSuggestedCases').mockResolvedValue(suggestedCases);
    const result = await useCase.getSuggestedCases(mockContext, CASE_ID);
    expect(result).toEqual(suggestedCases);
    expect(gateway).toHaveBeenCalled();
  });

  test('should add transfer records for both cases when a transfer order is completed', async () => {
    const order: TransferOrder = MockData.getTransferOrder({ override: { status: 'approved' } });

    const action: TransferOrderAction = {
      id: order.id,
      orderType: 'transfer',
      caseId: order.caseId,
      newCase: order.newCase,
      status: 'approved',
    };

    const transferIn: TransferFrom = {
      caseId: order.newCase.caseId,
      otherCase: getCaseSummaryFromTransferOrder(order),
      orderDate: order.orderDate,
      documentType: 'TRANSFER_FROM',
    };

    const transferOut: TransferTo = {
      caseId: order.caseId,
      otherCase: order.newCase,
      orderDate: order.orderDate,
      documentType: 'TRANSFER_TO',
    };

    const updateOrderFn = jest
      .spyOn(ordersRepo, 'updateOrder')
      .mockResolvedValue({ id: 'mock-guid' });
    const getOrderFn = jest.spyOn(ordersRepo, 'getOrder').mockResolvedValue(order);
    const transferToFn = jest.spyOn(casesRepo, 'createTransferTo');
    const transferFromFn = jest.spyOn(casesRepo, 'createTransferFrom');
    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory');

    await useCase.updateTransferOrder(mockContext, order.id, action);
    expect(updateOrderFn).toHaveBeenCalledWith(mockContext, order.id, action);
    expect(getOrderFn).toHaveBeenCalledWith(mockContext, order.id, order.caseId);
    expect(transferToFn).toHaveBeenCalledWith(mockContext, transferOut);
    expect(transferFromFn).toHaveBeenCalledWith(mockContext, transferIn);
    expect(auditFn).toHaveBeenCalled();
  });

  test('should add audit records when a transfer order is rejected', async () => {
    const order: TransferOrder = MockData.getTransferOrder({ override: { status: 'rejected' } });
    const orderTransfer: TransferOrderAction = {
      id: order.id,
      orderType: 'transfer',
      caseId: order.caseId,
      status: 'rejected',
    };

    const updateOrderFn = jest
      .spyOn(ordersRepo, 'updateOrder')
      .mockResolvedValue({ id: 'mock-guid' });
    const getOrderFn = jest.spyOn(ordersRepo, 'getOrder').mockResolvedValue(order);

    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory');

    await useCase.updateTransferOrder(mockContext, order.id, orderTransfer);
    expect(updateOrderFn).toHaveBeenCalledWith(mockContext, order.id, orderTransfer);
    expect(getOrderFn).toHaveBeenCalledWith(mockContext, order.id, order.caseId);
    expect(auditFn).toHaveBeenCalled();
  });

  test('should retrieve orders from legacy and persist to new system', async () => {
    const transfers = MockData.buildArray(MockData.getTransferOrder, 3);

    const consolidations = MockData.buildArray(MockData.getConsolidationOrder, 3);
    const rawConsolidationOrders = MockData.buildArray(MockData.getRawConsolidationOrder, 3);
    const startState = { documentType: 'ORDERS_SYNC_STATE', txId: '1234', id: 'guid-1' };

    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [startState],
    });

    jest.spyOn(MockOrdersGateway.prototype, 'getOrderSync').mockResolvedValue({
      consolidations: rawConsolidationOrders,
      transfers,
      maxTxId: '3000',
    });

    const endState = {
      ...startState,
      txId: '3000',
    };

    const mockPutOrders = jest
      .spyOn(OrdersCosmosDbRepository.prototype, 'putOrders')
      .mockImplementation((_context, orders) => {
        return Promise.resolve(orders);
      });

    const caseSummaries: Array<CaseSummary> = [
      consolidations[0].leadCase,
      ...consolidations[0].childCases,
      consolidations[1].leadCase,
      ...consolidations[1].childCases,
      consolidations[2].leadCase,
      ...consolidations[2].childCases,
    ];

    jest
      .spyOn(CasesLocalGateway.prototype, 'getCaseSummary')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve(caseSummaries.find((bCase) => bCase.caseId === caseId));
      });

    const mockUpdateState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'updateState')
      .mockImplementation(jest.fn());

    await useCase.syncOrders(mockContext);

    expect(mockPutOrders.mock.calls[0][1]).toEqual(transfers);
    expect(mockUpdateState).toHaveBeenCalledWith(mockContext, endState);
  });

  test('mapConsolidations should fetch a lead case if a case ID is found in an raw record in DXTR', async () => {
    const jobId = 0;

    // Add two consolidation orders, each with a lead case ID. One lead case ID will return a case, the other will not.
    const rawConsolidationOrders = [
      MockData.getRawConsolidationOrder({
        override: { jobId, caseId: '999-99-11111', leadCaseIdHint: '99-00000' },
      }),
      MockData.getRawConsolidationOrder({
        override: { jobId, caseId: '999-99-22222', leadCaseIdHint: '99-99999' },
      }),
    ];

    jest
      .spyOn(CasesLocalGateway.prototype, 'getCaseSummary')
      .mockResolvedValueOnce(MockData.getCaseSummary({ override: { caseId: '999-99-00000' } }))
      .mockRejectedValue(
        new NotFoundError('MOCK', { message: 'Case summary not found for case ID.' }),
      );

    // The consolidation order should contain three cases. One for each raw order, and one for the returned lead case.
    const map = await useCase.mapConsolidations(mockContext, rawConsolidationOrders);
    const caseIds = map.get(jobId).childCases.map((c) => c.caseId);
    expect(caseIds).toHaveLength(3);
    expect(caseIds).toContain('999-99-00000');
    expect(caseIds).toContain('999-99-11111');
    expect(caseIds).toContain('999-99-22222');
  });

  test('should handle a missing order runtime state when a starting transaction ID is provided', async () => {
    const transfers = MockData.buildArray(MockData.getTransferOrder, 3);
    const consolidations = MockData.buildArray(MockData.getConsolidationOrder, 3);
    const rawConsolidations = MockData.buildArray(MockData.getRawConsolidationOrder, 3);

    const id = 'guid-id';
    const txId = '1234';
    const initialState: OrderSyncState = { documentType: 'ORDERS_SYNC_STATE', txId };

    const mockGetState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'getState')
      .mockRejectedValue(
        new CamsError('COSMOS_DB_REPOSITORY_RUNTIME_STATE', {
          message: 'Initial state was not found or was ambiguous.',
        }),
      );

    const mockCreateState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'createState')
      .mockResolvedValue({ ...initialState, id });

    const mockGetOrderSync = jest
      .spyOn(MockOrdersGateway.prototype, 'getOrderSync')
      .mockResolvedValue({
        consolidations: rawConsolidations,
        transfers,
        maxTxId: '3000',
      });

    const endState = {
      ...initialState,
      txId: '3000',
      id,
    };

    const mockPutOrders = jest
      .spyOn(OrdersCosmosDbRepository.prototype, 'putOrders')
      .mockResolvedValueOnce(transfers)
      .mockResolvedValueOnce(consolidations);

    const mockUpdateState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'updateState')
      .mockImplementation(jest.fn());

    await useCase.syncOrders(mockContext, { txIdOverride: txId });

    expect(mockGetState).toHaveBeenCalled();
    expect(mockCreateState).toHaveBeenCalledWith(mockContext, initialState);
    expect(mockGetOrderSync).toHaveBeenCalled();
    expect(mockPutOrders).toHaveBeenCalled();
    expect(mockUpdateState).toHaveBeenCalledWith(mockContext, endState);
  });

  test('should throw an error with a missing order runtime state and no starting transaction ID is provided', async () => {
    const mockGetState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'getState')
      .mockRejectedValue(
        new CamsError('COSMOS_DB_REPOSITORY_RUNTIME_STATE', {
          message: 'Initial state was not found or was ambiguous.',
        }),
      );

    await expect(useCase.syncOrders(mockContext)).rejects.toThrow(
      'A transaction ID is required to seed the order sync run. Aborting.',
    );
    expect(mockGetState).toHaveBeenCalled();
  });

  test('should throw any other error when attempting to retrieve initial runtime state', async () => {
    const mockGetState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'getState')
      .mockRejectedValue(new Error('TEST'));

    await expect(useCase.syncOrders(mockContext)).rejects.toThrow('TEST');
    expect(mockGetState).toHaveBeenCalled();
  });

  test('should approve a consolidation order', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder({
      override: {
        status: 'approved',
      },
    });
    const mockDelete = jest
      .spyOn(CosmosDbRepository.prototype, 'delete')
      .mockResolvedValue(pendingConsolidation);
    const leadCaseSummary = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      ...pendingConsolidation,
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase: leadCaseSummary,
    };
    const newConsolidation = {
      ...pendingConsolidation,
      leadCase: leadCaseSummary,
      id: crypto.randomUUID(),
    };
    const mockPut = jest
      .spyOn(CosmosDbRepository.prototype, 'put')
      .mockResolvedValue(newConsolidation);
    const leadCaseBefore: ConsolidationOrderSummary = {
      status: 'pending',
      childCases: [],
    };
    const childCaseSummaries = newConsolidation.childCases.map((bCase) =>
      getCaseSummaryFromConsolidationOrderCase(bCase),
    );
    const leadCaseAfter: ConsolidationOrderSummary = {
      status: 'approved',
      childCases: childCaseSummaries,
    };
    const leadCaseHistory: Partial<CaseHistory> = {
      documentType: 'AUDIT_CONSOLIDATION',
      caseId: newConsolidation.leadCase.caseId,
      before: leadCaseBefore,
      after: leadCaseAfter,
    };
    const before: ConsolidationOrderSummary = {
      status: 'pending',
      childCases: [],
    };
    const after: ConsolidationOrderSummary = {
      status: 'approved',
      leadCase: newConsolidation.leadCase,
      childCases: [],
    };
    const childCaseHistory: Partial<CaseHistory> = {
      documentType: 'AUDIT_CONSOLIDATION',
      caseId: pendingConsolidation.childCases[0].caseId,
      before,
      after,
    };
    const initialCaseHistory: CaseHistory = {
      documentType: 'AUDIT_CONSOLIDATION',
      caseId: pendingConsolidation.childCases[0].caseId,
      before: null,
      after: before,
      occurredAtTimestamp: '2024-01-01T12:00:00.000Z',
    };
    const mockGetHistory = jest
      .spyOn(CasesCosmosDbRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });
    const mockCreateHistory = jest
      .spyOn(CasesCosmosDbRepository.prototype, 'createCaseHistory')
      .mockResolvedValue(crypto.randomUUID());

    const mockCreateAssignment = jest.spyOn(
      CaseAssignmentUseCase.prototype,
      'createTrialAttorneyAssignments',
    );
    const mockGetConsolidation = jest.spyOn(casesRepo, 'getConsolidation').mockResolvedValue([]);

    const actual = await useCase.approveConsolidation(mockContext, approval);
    expect(mockGetConsolidation).toHaveBeenCalledTimes(approval.childCases.length + 1);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalled();
    expect(mockCreateHistory.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[0].caseId,
      }),
    );
    expect(mockCreateHistory.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[1].caseId,
      }),
    );
    expect(mockCreateHistory.mock.calls[3][1]).toEqual(expect.objectContaining(leadCaseHistory));
    expect(mockGetHistory).toHaveBeenCalledTimes(pendingConsolidation.childCases.length + 1);
    expect(mockCreateAssignment).toHaveBeenCalledTimes(pendingConsolidation.childCases.length);
    expect(actual).toEqual([newConsolidation]);
  });

  test('should approve a split consolidation order', async () => {
    const originalConsolidation = MockData.getConsolidationOrder({
      override: {
        status: 'approved',
      },
    });
    const mockDelete = jest
      .spyOn(CosmosDbRepository.prototype, 'delete')
      .mockResolvedValue(originalConsolidation);
    const leadCaseSummary = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      ...originalConsolidation,
      approvedCases: [originalConsolidation.childCases[0].caseId],
      leadCase: leadCaseSummary,
    };

    const approvedConsolidation = {
      ...originalConsolidation,
      childCases: [originalConsolidation.childCases[0]],
      leadCase: leadCaseSummary,
      id: crypto.randomUUID(),
    };
    const newPendingConsolidation = {
      ...originalConsolidation,
      childCases: [originalConsolidation.childCases[1]],
      id: crypto.randomUUID(),
    };

    const mockPut = jest
      .spyOn(CosmosDbRepository.prototype, 'put')
      .mockResolvedValueOnce(newPendingConsolidation)
      .mockResolvedValueOnce(approvedConsolidation);
    const leadCaseBefore: ConsolidationOrderSummary = {
      status: 'pending',
      childCases: [],
    };
    const childCaseSummaries = approvedConsolidation.childCases.map((bCase) =>
      getCaseSummaryFromConsolidationOrderCase(bCase),
    );
    const leadCaseAfter: ConsolidationOrderSummary = {
      status: 'approved',
      childCases: [childCaseSummaries[0]],
    };
    const leadCaseHistory: Partial<CaseHistory> = {
      documentType: 'AUDIT_CONSOLIDATION',
      caseId: approvedConsolidation.leadCase.caseId,
      before: leadCaseBefore,
      after: leadCaseAfter,
    };
    const before: ConsolidationOrderSummary = {
      status: 'pending',
      childCases: [],
    };
    const after: ConsolidationOrderSummary = {
      status: 'approved',
      leadCase: approvedConsolidation.leadCase,
      childCases: [],
    };
    const childCaseHistory: Partial<CaseHistory> = {
      documentType: 'AUDIT_CONSOLIDATION',
      caseId: originalConsolidation.childCases[0].caseId,
      before,
      after,
    };
    const initialCaseHistory: CaseHistory = {
      documentType: 'AUDIT_CONSOLIDATION',
      caseId: originalConsolidation.childCases[0].caseId,
      before: null,
      after: before,
      occurredAtTimestamp: '2024-01-01T12:00:00.000Z',
    };
    const mockGetHistory = jest
      .spyOn(CasesCosmosDbRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });
    const mockCreateHistory = jest
      .spyOn(CasesCosmosDbRepository.prototype, 'createCaseHistory')
      .mockResolvedValue(crypto.randomUUID());
    const mockGetConsolidation = jest.spyOn(casesRepo, 'getConsolidation').mockResolvedValue([]);

    const actual = await useCase.approveConsolidation(mockContext, approval);
    expect(mockGetConsolidation).toHaveBeenCalledTimes(approval.childCases.length);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalled();
    expect(mockCreateHistory.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: originalConsolidation.childCases[0].caseId,
      }),
    );
    expect(mockCreateHistory.mock.calls[1][1]).toEqual(expect.objectContaining(leadCaseHistory));
    expect(mockGetHistory).toHaveBeenCalledTimes(approval.approvedCases.length + 1);
    expect(actual).toEqual([newPendingConsolidation, approvedConsolidation]);
  });

  test('should reject a consolidation order', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder({
      override: {
        status: 'rejected',
      },
    });
    const mockDelete = jest
      .spyOn(CosmosDbRepository.prototype, 'delete')
      .mockResolvedValue(pendingConsolidation);
    const leadCaseSummary = MockData.getCaseSummary();

    const rejectionReason = 'test';
    const rejection: ConsolidationOrderActionRejection = {
      ...pendingConsolidation,
      rejectedCases: pendingConsolidation.childCases.map((bCase) => bCase.caseId),
      reason: rejectionReason,
    };
    const newConsolidation = {
      ...pendingConsolidation,
      leadCase: leadCaseSummary,
      id: crypto.randomUUID(),
    };
    const mockPut = jest
      .spyOn(CosmosDbRepository.prototype, 'put')
      .mockResolvedValue(newConsolidation);
    const before: ConsolidationOrderSummary = {
      status: 'pending',
      childCases: [],
    };
    const after: ConsolidationOrderSummary = {
      status: 'rejected',
      childCases: [],
    };
    const childCaseHistory: Partial<CaseHistory> = {
      documentType: 'AUDIT_CONSOLIDATION',
      caseId: pendingConsolidation.childCases[0].caseId,
      before,
      after,
    };
    const initialCaseHistory: CaseHistory = {
      documentType: 'AUDIT_CONSOLIDATION',
      caseId: pendingConsolidation.childCases[0].caseId,
      before: null,
      after: before,
      occurredAtTimestamp: '2024-01-01T12:00:00.000Z',
    };
    const mockGetHistory = jest
      .spyOn(CasesCosmosDbRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });
    const mockCreateHistory = jest
      .spyOn(CasesCosmosDbRepository.prototype, 'createCaseHistory')
      .mockResolvedValue(crypto.randomUUID());
    const mockGetConsolidation = jest.spyOn(casesRepo, 'getConsolidation').mockResolvedValue([]);

    const actual = await useCase.rejectConsolidation(mockContext, rejection);
    expect(mockGetConsolidation).toHaveBeenCalledTimes(0);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalled();
    expect(mockCreateHistory.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[0].caseId,
      }),
    );
    expect(mockCreateHistory.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[1].caseId,
      }),
    );
    expect(mockGetHistory).toHaveBeenCalledTimes(pendingConsolidation.childCases.length);
    expect(actual).toEqual([newConsolidation]);
  });

  test('should reject a split consolidation order', () => {
    // This is the same logic as a split approved consolidation order, except the existing child case guard logic is not executed.
  });

  test('should throw an error if a child case is part of another consolidation', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      ...pendingConsolidation,
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase,
      status: 'approved',
    };
    const mockGetConsolidation = jest
      .spyOn(casesRepo, 'getConsolidation')
      .mockResolvedValueOnce([
        MockData.getConsolidationReference({
          override: { caseId: approval.childCases[0].caseId, documentType: 'CONSOLIDATION_TO' },
        }),
      ])
      .mockResolvedValue([]);

    // const _actual = useCase.approveConsolidation(mockContext, approval);
    await expect(useCase.approveConsolidation(mockContext, approval)).rejects.toThrow(
      'Cannot consolidate order. A child case has already been consolidated.',
    );
    expect(mockGetConsolidation).toHaveBeenCalled();
  });

  test('should throw an error if a lead case is a child case of another consolidation', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      ...pendingConsolidation,
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase,
      status: 'approved',
    };
    const mockGetConsolidation = jest
      .spyOn(casesRepo, 'getConsolidation')
      .mockImplementation((_context, caseId: string) => {
        if (caseId === leadCase.caseId) {
          return Promise.resolve([
            MockData.getConsolidationReference({
              override: { caseId: leadCase.caseId, documentType: 'CONSOLIDATION_TO' },
            }),
          ]);
        } else {
          return Promise.resolve([]);
        }
      });

    // const _actual = useCase.approveConsolidation(mockContext, approval);
    await expect(useCase.approveConsolidation(mockContext, approval)).rejects.toThrow(
      'Cannot consolidate order. The lead case is a child case of another consolidation.',
    );
    expect(mockGetConsolidation).toHaveBeenCalled();
  });
});
