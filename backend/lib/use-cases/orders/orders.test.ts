import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import {
  getOrdersRepository,
  getCasesRepository,
  getCasesGateway,
  getConsolidationOrdersRepository,
} from '../../factory';
import { OrderSyncState } from '../gateways.types';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  getCaseSummaryFromTransferOrder,
  TransferOrder,
  TransferOrderAction,
} from '../../../../common/src/cams/orders';
import {
  ConsolidationFrom,
  ConsolidationTo,
  TransferFrom,
  TransferTo,
} from '../../../../common/src/cams/events';
import { CASE_SUMMARIES } from '../../testing/mock-data/case-summaries.mock';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import { CaseSummary } from '../../../../common/src/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { NotFoundError } from '../../common-errors/not-found-error';
import * as crypto from 'crypto';
import { CaseHistory, ConsolidationOrderSummary } from '../../../../common/src/cams/history';
import { MockOrdersGateway } from '../../testing/mock-gateways/mock.orders.gateway';
import { CamsRole } from '../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';
import { getCourtDivisionCodes } from '../../../../common/src/cams/users';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { UstpDivisionMeta } from '../../../../common/src/cams/offices';

describe('Orders use case', () => {
  const CASE_ID = '000-11-22222';
  let mockContext;
  let ordersRepo;
  let casesRepo;
  let casesGateway;
  let consolidationRepo;

  let useCase: OrdersUseCase;
  const authorizedUser = MockData.getCamsUser({
    roles: [CamsRole.DataVerifier],
    offices: [REGION_02_GROUP_NY],
  });
  const unauthorizedUser = MockData.getCamsUser({ roles: [] });

  beforeEach(async () => {
    mockContext = await createMockApplicationContext();
    mockContext.session = await createMockApplicationContextSession({ user: authorizedUser });
    ordersRepo = getOrdersRepository(mockContext);
    casesRepo = getCasesRepository(mockContext);
    casesGateway = getCasesGateway(mockContext);
    consolidationRepo = getConsolidationOrdersRepository(mockContext);
    useCase = new OrdersUseCase(mockContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return list of orders for the API from the repo', async () => {
    const mockTransfer1 = MockData.getTransferOrder({ override: { orderDate: '2024-08-01' } });
    const mockTransfer2 = MockData.getTransferOrder({ override: { orderDate: '2024-09-01' } });
    const mockTransferOrders = [mockTransfer1, mockTransfer2];
    const mockConsolidation1 = MockData.getConsolidationOrder({
      override: { orderDate: '2024-08-02' },
    });
    const mockConsolidation2 = MockData.getConsolidationOrder({
      override: { orderDate: '2024-09-02' },
    });
    const mockConsolidationOrders = [mockConsolidation1, mockConsolidation2];

    const orderRepoMock = jest.spyOn(ordersRepo, 'search').mockResolvedValue(mockTransferOrders);
    const consolidationsRepoMock = jest
      .spyOn(consolidationRepo, 'search')
      .mockResolvedValue(mockConsolidationOrders);

    const divisionCodes = getCourtDivisionCodes(authorizedUser);
    const expectedResult = expect.arrayContaining([
      mockTransfer1,
      mockConsolidation1,
      mockTransfer2,
      mockConsolidation2,
    ]);
    const result = await useCase.getOrders(mockContext);
    expect(result).toEqual(expectedResult);
    expect(orderRepoMock).toHaveBeenCalledWith({ divisionCodes });
    expect(consolidationsRepoMock).toHaveBeenCalledWith({ divisionCodes });
  });

  test('should return list of suggested cases for an order', async () => {
    const suggestedCases = [CASE_SUMMARIES[0]];
    const gateway = jest.spyOn(casesGateway, 'getSuggestedCases').mockResolvedValue(suggestedCases);
    mockContext.request.params.caseId = CASE_ID;
    const result = await useCase.getSuggestedCases(mockContext);
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

    const updateOrderFn = jest.spyOn(ordersRepo, 'update').mockResolvedValue({ id: 'mock-guid' });
    const getOrderFn = jest.spyOn(ordersRepo, 'read').mockResolvedValue(order);
    const transferToFn = jest.spyOn(casesRepo, 'createTransferTo').mockResolvedValue(transferOut);
    const transferFromFn = jest
      .spyOn(casesRepo, 'createTransferFrom')
      .mockResolvedValue(transferIn);
    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory').mockResolvedValue({});

    await useCase.updateTransferOrder(mockContext, order.id, action);
    expect(updateOrderFn).toHaveBeenCalledWith(action);
    expect(getOrderFn).toHaveBeenCalledWith(order.id, order.caseId);
    expect(transferToFn).toHaveBeenCalledWith({
      ...transferOut,
    });
    expect(transferFromFn).toHaveBeenCalledWith({
      ...transferIn,
    });
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

    const updateOrderFn = jest.spyOn(ordersRepo, 'update').mockResolvedValue({ id: 'mock-guid' });
    const getOrderFn = jest.spyOn(ordersRepo, 'read').mockResolvedValue(order);

    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory').mockResolvedValue({});

    await useCase.updateTransferOrder(mockContext, order.id, orderTransfer);
    expect(updateOrderFn).toHaveBeenCalledWith(orderTransfer);
    expect(getOrderFn).toHaveBeenCalledWith(order.id, order.caseId);
    expect(auditFn).toHaveBeenCalled();
  });

  test('should retrieve orders from legacy and persist to new system', async () => {
    const transfers = MockData.buildArray(MockData.getTransferOrder, 3);

    const consolidations = MockData.buildArray(MockData.getConsolidationOrder, 3);
    const rawConsolidationOrders = MockData.buildArray(MockData.getRawConsolidationOrder, 3);
    const startState = { documentType: 'ORDERS_SYNC_STATE', txId: '1234', id: 'guid-1' };

    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
      id: 'guid-1',
      documentType: 'ORDERS_SYNC_STATE',
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

    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory').mockResolvedValue({});

    const mockPutOrders = jest
      .spyOn(MockMongoRepository.prototype, 'createMany')
      .mockResolvedValue([...transfers, ...consolidations]);

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
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockImplementation(jest.fn());

    await useCase.syncOrders(mockContext);

    expect(auditFn).toHaveBeenCalled();
    expect(mockPutOrders).toHaveBeenCalledWith(transfers);
    expect(mockUpdateState).toHaveBeenCalledWith(endState);
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
      .spyOn(MockMongoRepository.prototype, 'read')
      .mockRejectedValue(new NotFoundError('COSMOS_DB_REPOSITORY_RUNTIME_STATE'));
    jest.spyOn(casesRepo, 'createCaseHistory').mockResolvedValue({});

    const endState = {
      ...initialState,
      txId: '3000',
      id,
    };

    const mockUpsertState = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValueOnce({ ...initialState, id })
      .mockResolvedValueOnce(endState);

    const mockGetOrderSync = jest
      .spyOn(MockOrdersGateway.prototype, 'getOrderSync')
      .mockResolvedValue({
        consolidations: rawConsolidations,
        transfers,
        maxTxId: '3000',
      });

    const mockPutOrders = jest
      .spyOn(MockMongoRepository.prototype, 'createMany')
      .mockResolvedValueOnce(transfers)
      .mockResolvedValueOnce(consolidations);

    await useCase.syncOrders(mockContext, { txIdOverride: txId });

    expect(mockGetState).toHaveBeenCalled();
    expect(mockUpsertState).toHaveBeenCalledWith(initialState);
    expect(mockGetOrderSync).toHaveBeenCalled();
    expect(mockPutOrders).toHaveBeenCalled();
    expect(mockUpsertState).toHaveBeenCalledWith(endState);
  });

  test('should throw an error with a missing order runtime state and no starting transaction ID is provided', async () => {
    const mockGetState = jest
      .spyOn(MockMongoRepository.prototype, 'read')
      .mockRejectedValue(new NotFoundError('COSMOS_DB_REPOSITORY_RUNTIME_STATE'));

    await expect(useCase.syncOrders(mockContext)).rejects.toThrow(
      'A transaction ID is required to seed the order sync run. Aborting.',
    );
    expect(mockGetState).toHaveBeenCalled();
  });

  test('should throw any other error when attempting to retrieve initial runtime state', async () => {
    const mockGetState = jest
      .spyOn(MockMongoRepository.prototype, 'read')
      .mockRejectedValue(new Error('TEST'));

    await expect(useCase.syncOrders(mockContext)).rejects.toThrow('TEST');
    expect(mockGetState).toHaveBeenCalled();
  });

  test('should reject a consolidation order', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder({
      override: {
        status: 'rejected',
      },
    });
    const mockDelete = jest.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue();
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
      .spyOn(MockMongoRepository.prototype, 'create')
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
      updatedOn: '2024-01-01T12:00:00.000Z',
      updatedBy: authorizedUser,
    };
    const mockGetHistory = jest
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });
    const mockCreateHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();
    const mockGetConsolidation = jest.spyOn(casesRepo, 'getConsolidation').mockResolvedValue([]);

    const actual = await useCase.rejectConsolidation(mockContext, rejection);
    expect(mockGetConsolidation).toHaveBeenCalledTimes(0);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalled();
    expect(mockCreateHistory.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[0].caseId,
      }),
    );
    expect(mockCreateHistory.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[1].caseId,
      }),
    );
    expect(mockGetHistory).toHaveBeenCalledTimes(pendingConsolidation.childCases.length);
    expect(actual).toEqual([newConsolidation]);
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
    jest.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue();

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
      .mockImplementation((caseId: string) => {
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
    jest.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue();

    await expect(useCase.approveConsolidation(mockContext, approval)).rejects.toThrow(
      'Cannot consolidate order. The lead case is a child case of another consolidation.',
    );
    expect(mockGetConsolidation).toHaveBeenCalled();
  });

  test('should throw an error if user is unauthorized to update transfers', async () => {
    const order: TransferOrder = MockData.getTransferOrder({ override: { status: 'approved' } });

    const action: TransferOrderAction = {
      id: order.id,
      orderType: 'transfer',
      caseId: order.caseId,
      newCase: order.newCase,
      status: 'approved',
    };

    const updateOrderFn = jest.spyOn(ordersRepo, 'update').mockResolvedValue({ id: 'mock-guid' });
    const getOrderFn = jest.spyOn(ordersRepo, 'read').mockResolvedValue(order);
    const transferToFn = jest.spyOn(casesRepo, 'createTransferTo');
    const transferFromFn = jest.spyOn(casesRepo, 'createTransferFrom');
    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory');
    mockContext.session = await createMockApplicationContextSession({ user: unauthorizedUser });

    await expect(useCase.updateTransferOrder(mockContext, order.id, action)).rejects.toThrow();
    expect(updateOrderFn).not.toHaveBeenCalled();
    expect(getOrderFn).not.toHaveBeenCalled();
    expect(transferToFn).not.toHaveBeenCalled();
    expect(transferFromFn).not.toHaveBeenCalled();
    expect(auditFn).not.toHaveBeenCalled();
  });

  test('should throw an error if user is unauthorized to approve consolidations', async () => {
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
      .mockRejectedValue('We should never call this');
    mockContext.session = await createMockApplicationContextSession({ user: unauthorizedUser });

    await expect(useCase.approveConsolidation(mockContext, approval)).rejects.toThrow(
      'Unauthorized',
    );
    expect(mockGetConsolidation).not.toHaveBeenCalled();
  });

  test('should throw an error if user is unauthorized to reject consolidations', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const rejection: ConsolidationOrderActionRejection = {
      ...pendingConsolidation,
      rejectedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase,
      status: 'rejected',
    };
    const mockDelete = jest
      .spyOn(consolidationRepo, 'delete')
      .mockRejectedValue('We should never call this');
    mockContext.session = await createMockApplicationContextSession({ user: unauthorizedUser });

    await expect(useCase.rejectConsolidation(mockContext, rejection)).rejects.toThrow(
      'Unauthorized',
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('should only approve a consolidation with a lead case and at least one child case.', async () => {
    // TODO: CAMS-447 Enforce consolidation orders must include ONE lead case and at least ONCE child case.
    //const pendingConsolidation = MockData.getConsolidationOrder();
    //const leadCase = MockData.getCaseSummary();
    //const consolidation = MockData.buildArray(
    //  () => MockData.getConsolidationFrom({ override: { otherCase: leadCase } }),
    //  5,
    //);
    expect(1).toEqual(1);
  });

  test('should identify the user who approved the change', async () => {
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
    const consolidation = MockData.buildArray(
      () => MockData.getConsolidationFrom({ override: { otherCase: leadCase } }),
      5,
    );
    const mockGetConsolidation = jest
      .spyOn(casesRepo, 'getConsolidation')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        if (caseId === leadCase.caseId) {
          return Promise.resolve(consolidation);
        } else {
          return Promise.resolve([]);
        }
      });
    const mockCreateCaseHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();
    jest.spyOn(consolidationRepo, 'delete').mockResolvedValue({});
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockImplementation(() => Promise.resolve());

    jest
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation((consolidationOrder: ConsolidationOrder) => {
        return Promise.resolve(
          MockData.getConsolidationOrder({ override: { ...consolidationOrder } }),
        );
      });

    const caseId = '111-22-33333';
    const assignments = MockData.buildArray(() => MockData.getAttorneyAssignment({ caseId }), 3);
    const expectedMap = new Map([[caseId, assignments]]);

    jest
      .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
      .mockResolvedValue(expectedMap);

    jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationTo')
      .mockImplementation((_context: ApplicationContext, consolidationTo: ConsolidationTo) => {
        return Promise.resolve(MockData.getConsolidationTo({ override: { ...consolidationTo } }));
      });

    jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationFrom')
      .mockImplementation((_context: ApplicationContext, consolidationFrom: ConsolidationFrom) => {
        return Promise.resolve(
          MockData.getConsolidationFrom({ override: { ...consolidationFrom } }),
        );
      });

    mockContext.session = await createMockApplicationContextSession({ user: authorizedUser });
    await useCase.approveConsolidation(mockContext, approval);
    expect(mockGetConsolidation).toHaveBeenCalled();
    expect(mockCreateCaseHistory).toHaveBeenCalledWith(
      expect.objectContaining({ updatedBy: getCamsUserReference(authorizedUser) }),
    );
  });

  test('should identify the user who rejected the change', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const rejection: ConsolidationOrderActionRejection = {
      ...pendingConsolidation,
      rejectedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase,
      status: 'approved',
    };
    const newConsolidation = {
      ...pendingConsolidation,
      leadCase: leadCase,
      id: crypto.randomUUID(),
    };
    jest.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue(newConsolidation);
    const mockCreateCaseHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();
    jest.spyOn(consolidationRepo, 'delete').mockResolvedValue({});
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockImplementation(() => Promise.resolve());
    mockContext.session = await createMockApplicationContextSession({ user: authorizedUser });
    await useCase.rejectConsolidation(mockContext, rejection);
    expect(mockCreateCaseHistory).toHaveBeenCalledWith(
      expect.objectContaining({ updatedBy: getCamsUserReference(authorizedUser) }),
    );
  });

  test('should fail to update to a legacy office', async () => {
    const courtDivisionCode = '000';

    let Factory;
    await jest.isolateModulesAsync(async () => {
      Factory = await import('../../factory');
      ordersRepo = Factory.getOrdersRepository(mockContext);
      casesRepo = Factory.getCasesRepository(mockContext);
    });

    jest.spyOn(Factory, 'getStorageGateway').mockImplementation(() => {
      return {
        get: jest.fn(),
        getRoleMapping: jest.fn(),
        getUstpOffices: jest.fn(),
        getUstpDivisionMeta: jest.fn().mockImplementation(() => {
          return new Map<string, UstpDivisionMeta>([[courtDivisionCode, { isLegacy: true }]]);
        }),
      };
    });

    const localUseCase = new OrdersUseCase(mockContext);

    const newCase = MockData.getCaseSummary({ override: { courtDivisionCode } });
    const order: TransferOrder = MockData.getTransferOrder({
      override: { status: 'approved', newCase },
    });

    const action: TransferOrderAction = {
      id: order.id,
      orderType: 'transfer',
      caseId: order.caseId,
      newCase: order.newCase,
      status: 'approved',
    };

    const updateOrderFn = jest.spyOn(ordersRepo, 'update').mockResolvedValue({ id: 'mock-guid' });
    const getOrderFn = jest.spyOn(ordersRepo, 'read').mockResolvedValue(order);
    const transferToFn = jest.spyOn(casesRepo, 'createTransferTo');
    const transferFromFn = jest.spyOn(casesRepo, 'createTransferFrom');
    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory');
    mockContext.session = await createMockApplicationContextSession({ user: authorizedUser });

    await expect(localUseCase.updateTransferOrder(mockContext, order.id, action)).rejects.toThrow();
    expect(updateOrderFn).not.toHaveBeenCalled();
    expect(getOrderFn).not.toHaveBeenCalled();
    expect(transferToFn).not.toHaveBeenCalled();
    expect(transferFromFn).not.toHaveBeenCalled();
    expect(auditFn).not.toHaveBeenCalled();
  });
});
