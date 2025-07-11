import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import {
  getCasesGateway,
  getCasesRepository,
  getConsolidationOrdersRepository,
  getOrdersRepository,
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
import { CaseAssignment } from '../../../../common/src/cams/assignments';

describe('Orders use case', () => {
  const ORIGINAL_ENV = process.env;

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

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      CAMS_LOGIN_PROVIDER: 'mock',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    mockContext = await createMockApplicationContext();
    mockContext.session = await createMockApplicationContextSession({ user: authorizedUser });
    ordersRepo = getOrdersRepository(mockContext);
    casesRepo = getCasesRepository(mockContext);
    casesGateway = getCasesGateway(mockContext);
    consolidationRepo = getConsolidationOrdersRepository(mockContext);
    useCase = new OrdersUseCase(mockContext);

    jest.spyOn(MockMongoRepository.prototype, 'count').mockResolvedValue(0);
    jest
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation((order) => Promise.resolve(order));
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
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(pendingConsolidation);
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

  test('should reject a consolidation order and save a new pending order when only a subset of cases are rejected', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const mockDelete = jest
      .spyOn(MockMongoRepository.prototype, 'delete')
      .mockRejectedValue(new Error('should not be called'));
    const leadCaseSummary = MockData.getCaseSummary();

    const rejectionReason = 'test';
    const rejection: ConsolidationOrderActionRejection = {
      rejectedCases: [pendingConsolidation.childCases[0].caseId],
      reason: rejectionReason,
      consolidationId: pendingConsolidation.id,
    };
    const newConsolidation = {
      ...pendingConsolidation,
      leadCase: leadCaseSummary,
      id: crypto.randomUUID(),
    };
    const newPendingConsolidation = {
      ...pendingConsolidation,
      id: crypto.randomUUID(),
      status: 'pending',
      childCases: pendingConsolidation.childCases.filter(
        (bCase) => pendingConsolidation.childCases[0].caseId !== bCase.caseId,
      ),
    };
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(pendingConsolidation);

    const mockPut = jest
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockResolvedValue(newConsolidation);
    const mockUpdate = jest
      .spyOn(MockMongoRepository.prototype, 'update')
      .mockResolvedValue(newPendingConsolidation);

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
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockCreateHistory.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[0].caseId,
      }),
    );
    expect(mockGetHistory).toHaveBeenCalledTimes(1);
    expect(actual).toEqual(expect.arrayContaining([newPendingConsolidation, newConsolidation]));
  });

  test('should throw an error if a child case is part of another consolidation', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase,
      consolidationId: pendingConsolidation.id,
      consolidationType: pendingConsolidation.consolidationType,
    };
    const mockGetConsolidation = jest
      .spyOn(casesRepo, 'getConsolidation')
      .mockResolvedValueOnce([
        MockData.getConsolidationReference({
          override: {
            caseId: pendingConsolidation.childCases[0].caseId,
            documentType: 'CONSOLIDATION_TO',
          },
        }),
      ])
      .mockResolvedValue([]);
    jest.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue();
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(pendingConsolidation);

    await expect(useCase.approveConsolidation(mockContext, approval)).rejects.toThrow(
      'Cannot consolidate order. A child case has already been consolidated.',
    );
    expect(mockGetConsolidation).toHaveBeenCalled();
  });

  test('should throw an error if a lead case is a child case of another consolidation', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase,
      consolidationId: pendingConsolidation.id,
      consolidationType: pendingConsolidation.consolidationType,
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
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(pendingConsolidation);

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
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase,
      consolidationId: pendingConsolidation.id,
      consolidationType: pendingConsolidation.consolidationType,
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

  test('should not approve a consolidation without at least one child case.', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      approvedCases: [],
      leadCase,
      consolidationId: pendingConsolidation.id,
      consolidationType: pendingConsolidation.consolidationType,
    };
    await expect(useCase.approveConsolidation(mockContext, approval)).rejects.toThrow(
      'Consolidation approvals require at least one child case.',
    );
  });

  test('should throw an error if user is unauthorized to reject consolidations', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const rejection: ConsolidationOrderActionRejection = {
      rejectedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      consolidationId: pendingConsolidation.id,
      reason: 'reject reason',
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

  test('should approve and return a consolidation order', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase,
      consolidationId: pendingConsolidation.id,
      consolidationType: pendingConsolidation.consolidationType,
    };
    const newConsolidation = {
      ...pendingConsolidation,
      status: 'approved',
      leadCase: leadCase,
      id: crypto.randomUUID(),
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

    const before: ConsolidationOrderSummary = {
      status: 'pending',
      childCases: [],
    };
    const after: ConsolidationOrderSummary = {
      status: 'approved',
      leadCase: expect.anything(),
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
    jest
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });
    const mockCreateCaseHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();
    jest.spyOn(consolidationRepo, 'delete').mockResolvedValue({});
    jest.spyOn(consolidationRepo, 'read').mockResolvedValue(pendingConsolidation);
    const createAssignmentsSpy = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockImplementation(() => Promise.resolve());

    jest.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue(newConsolidation);

    const expectedMap: Map<string, CaseAssignment[]> = new Map();
    const leadCaseAssignments = MockData.buildArray(
      () => MockData.getAttorneyAssignment({ caseId: leadCase.caseId }),
      3,
    );
    const leadCaseAssignees = leadCaseAssignments.map((assignment) => {
      return { id: assignment.userId, name: assignment.name };
    });
    expectedMap.set(leadCase.caseId, leadCaseAssignments);
    pendingConsolidation.childCases.forEach((childCase) => {
      expectedMap.set(
        childCase.caseId,
        MockData.buildArray(() => MockData.getAttorneyAssignment({ caseId: childCase.caseId }), 3),
      );
    });

    jest
      .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
      .mockResolvedValue(expectedMap);

    const mockCreateConsolidationTo = jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationTo')
      .mockImplementation((_context: ApplicationContext, consolidationTo: ConsolidationTo) => {
        return Promise.resolve(MockData.getConsolidationTo({ override: { ...consolidationTo } }));
      });

    const mockCreateConsolidationFrom = jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationFrom')
      .mockImplementation((_context: ApplicationContext, consolidationFrom: ConsolidationFrom) => {
        return Promise.resolve(
          MockData.getConsolidationFrom({ override: { ...consolidationFrom } }),
        );
      });

    const actual = await useCase.approveConsolidation(mockContext, approval);
    expect(mockGetConsolidation).toHaveBeenCalled();
    expect(mockCreateCaseHistory.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[0].caseId,
      }),
    );
    expect(mockCreateCaseHistory.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[1].caseId,
      }),
    );

    // Verify that createConsolidationTo and createConsolidationFrom are called for each child case
    expect(mockCreateConsolidationTo).toHaveBeenCalledTimes(pendingConsolidation.childCases.length);
    expect(mockCreateConsolidationFrom).toHaveBeenCalledTimes(
      pendingConsolidation.childCases.length,
    );

    // Verify that the child cases in the AUDIT_CONSOLIDATION document include all approved cases
    const leadCaseHistory = mockCreateCaseHistory.mock.calls.find(
      (call) => call[0].caseId === leadCase.caseId,
    );
    expect(leadCaseHistory[0].after.childCases).toHaveLength(
      pendingConsolidation.childCases.length,
    );

    // Verify that createTrialAttorneyAssignments is called once for each approved child
    expect(createAssignmentsSpy).toHaveBeenCalledTimes(approval.approvedCases.length);
    approval.approvedCases.forEach((approvedCase) => {
      expect(createAssignmentsSpy).toHaveBeenCalledWith(
        expect.anything(),
        approvedCase,
        leadCaseAssignees,
        CamsRole.TrialAttorney,
        { processRoles: [CamsRole.CaseAssignmentManager] },
      );
    });

    expect(actual).toEqual([newConsolidation]);
  });

  test('should approve a consolidation order with additional cases not in the provisional order', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();

    // Create additional case that's not in the provisional order
    const additionalCase = MockData.getCaseSummary({
      override: { caseId: MockData.randomCaseId() },
    });

    // Include the additional case in the approved cases
    const approval: ConsolidationOrderActionApproval = {
      approvedCases: [
        ...pendingConsolidation.childCases.map((bCase) => bCase.caseId),
        additionalCase.caseId,
      ],
      leadCase,
      consolidationId: pendingConsolidation.id,
      consolidationType: pendingConsolidation.consolidationType,
    };

    // Mock the getCaseSummary to return the additional case
    jest
      .spyOn(CasesLocalGateway.prototype, 'getCaseSummary')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        if (caseId === additionalCase.caseId) {
          return Promise.resolve(additionalCase);
        }
        return Promise.resolve(null);
      });

    const newConsolidation = {
      ...pendingConsolidation,
      status: 'approved',
      leadCase: leadCase,
      id: crypto.randomUUID(),
      // The new consolidation should include all child cases, including the additional one
      childCases: [
        ...pendingConsolidation.childCases,
        {
          ...additionalCase,
          orderDate: pendingConsolidation.orderDate,
          docketEntries: [],
        },
      ],
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

    const before: ConsolidationOrderSummary = {
      status: 'pending',
      childCases: [],
    };

    const initialCaseHistory: CaseHistory = {
      documentType: 'AUDIT_CONSOLIDATION',
      caseId: pendingConsolidation.childCases[0].caseId,
      before: null,
      after: before,
      updatedOn: '2024-01-01T12:00:00.000Z',
      updatedBy: authorizedUser,
    };

    jest
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });

    const mockCreateCaseHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();

    jest.spyOn(consolidationRepo, 'delete').mockResolvedValue({});
    jest.spyOn(consolidationRepo, 'read').mockResolvedValue(pendingConsolidation);

    const createAssignmentsSpy = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue();

    jest.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue(newConsolidation);

    const expectedMap: Map<string, CaseAssignment[]> = new Map();
    const leadCaseAssignments = MockData.buildArray(
      () => MockData.getAttorneyAssignment({ caseId: leadCase.caseId }),
      3,
    );
    const leadCaseAssignees = leadCaseAssignments.map((assignment) => {
      return { id: assignment.userId, name: assignment.name };
    });
    expectedMap.set(leadCase.caseId, leadCaseAssignments);
    pendingConsolidation.childCases.forEach((childCase) => {
      expectedMap.set(
        childCase.caseId,
        MockData.buildArray(() => MockData.getAttorneyAssignment({ caseId: childCase.caseId }), 3),
      );
    });

    jest
      .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
      .mockResolvedValue(expectedMap);

    const mockCreateConsolidationTo = jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationTo')
      .mockImplementation((_context: ApplicationContext, consolidationTo: ConsolidationTo) => {
        return Promise.resolve(MockData.getConsolidationTo({ override: { ...consolidationTo } }));
      });

    const mockCreateConsolidationFrom = jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationFrom')
      .mockImplementation((_context: ApplicationContext, consolidationFrom: ConsolidationFrom) => {
        return Promise.resolve(
          MockData.getConsolidationFrom({ override: { ...consolidationFrom } }),
        );
      });

    jest.spyOn(casesGateway, 'getCaseSummary').mockResolvedValue(additionalCase);

    const actual = await useCase.approveConsolidation(mockContext, approval);

    // Verify that getConsolidation is called for all cases
    expect(mockGetConsolidation).toHaveBeenCalledTimes(approval.approvedCases.length + 1); // +1 for lead case

    // Verify that createCaseHistory is called for all child cases, including the additional one
    expect(mockCreateCaseHistory).toHaveBeenCalledTimes(approval.approvedCases.length + 1); // +1 for lead case

    // Verify that createConsolidationTo and createConsolidationFrom are called for all child cases
    expect(mockCreateConsolidationTo).toHaveBeenCalledTimes(approval.approvedCases.length);
    expect(mockCreateConsolidationFrom).toHaveBeenCalledTimes(approval.approvedCases.length);

    // Verify that the additional case is included in the calls to createConsolidationTo
    const additionalCaseToCall = mockCreateConsolidationTo.mock.calls.find(
      (call) => call[0].caseId === additionalCase.caseId,
    );
    expect(additionalCaseToCall).toBeDefined();

    // Verify that the additional case is included in the calls to createConsolidationFrom
    const additionalCaseFromCall = mockCreateConsolidationFrom.mock.calls.find(
      (call) => call[0].otherCase.caseId === additionalCase.caseId,
    );
    expect(additionalCaseFromCall).toBeDefined();

    // Verify that the child cases in the AUDIT_CONSOLIDATION document include all approved cases
    const leadCaseHistory = mockCreateCaseHistory.mock.calls.find(
      (call) => call[0].caseId === leadCase.caseId,
    );
    expect(leadCaseHistory[0].after.childCases).toHaveLength(approval.approvedCases.length);

    // Verify that the additional case is included in the lead case history
    const additionalCaseInHistory = leadCaseHistory[0].after.childCases.find(
      (childCase) => childCase.caseId === additionalCase.caseId,
    );
    expect(additionalCaseInHistory).toBeDefined();

    // Verify that createTrialAttorneyAssignments is called once for each approved child
    expect(createAssignmentsSpy).toHaveBeenCalledTimes(approval.approvedCases.length);
    approval.approvedCases.forEach((approvedCase) => {
      expect(createAssignmentsSpy).toHaveBeenCalledWith(
        expect.anything(),
        approvedCase,
        leadCaseAssignees,
        CamsRole.TrialAttorney,
        { processRoles: [CamsRole.CaseAssignmentManager] },
      );
    });

    expect(actual).toEqual([newConsolidation]);
  });

  test('should approve a consolidation order and save a new pending order when only a subset of cases are approved', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      approvedCases: [pendingConsolidation.childCases[0].caseId],
      leadCase,
      consolidationId: pendingConsolidation.id,
      consolidationType: pendingConsolidation.consolidationType,
    };
    const newConsolidation = {
      ...pendingConsolidation,
      childCases: [pendingConsolidation.childCases[0]],
      status: 'approved',
      leadCase: leadCase,
      id: crypto.randomUUID(),
    };
    const newPendingConsolidation = {
      ...pendingConsolidation,
      id: crypto.randomUUID(),
      status: 'pending',
      childCases: pendingConsolidation.childCases.filter(
        (bCase) => pendingConsolidation.childCases[0].caseId !== bCase.caseId,
      ),
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

    const before: ConsolidationOrderSummary = {
      status: 'pending',
      childCases: [],
    };
    const after: ConsolidationOrderSummary = {
      status: 'approved',
      leadCase: expect.anything(),
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
    jest
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });
    const mockCreateCaseHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();
    jest.spyOn(consolidationRepo, 'delete').mockRejectedValue(new Error('should not be called'));
    jest.spyOn(consolidationRepo, 'read').mockResolvedValue(pendingConsolidation);
    const createAssignmentsSpy = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue();

    jest.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue(newConsolidation);
    jest.spyOn(MockMongoRepository.prototype, 'update').mockResolvedValue(newPendingConsolidation);

    const expectedMap: Map<string, CaseAssignment[]> = new Map();
    const leadCaseAssignments = MockData.buildArray(
      () => MockData.getAttorneyAssignment({ caseId: leadCase.caseId }),
      3,
    );
    const leadCaseAssignees = leadCaseAssignments.map((assignment) => {
      return { id: assignment.userId, name: assignment.name };
    });
    expectedMap.set(leadCase.caseId, leadCaseAssignments);
    pendingConsolidation.childCases.forEach((childCase) => {
      expectedMap.set(
        childCase.caseId,
        MockData.buildArray(() => MockData.getAttorneyAssignment({ caseId: childCase.caseId }), 3),
      );
    });

    jest
      .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
      .mockResolvedValue(expectedMap);

    const mockCreateConsolidationTo = jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationTo')
      .mockImplementation((_context: ApplicationContext, consolidationTo: ConsolidationTo) => {
        return Promise.resolve(MockData.getConsolidationTo({ override: { ...consolidationTo } }));
      });

    const mockCreateConsolidationFrom = jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationFrom')
      .mockImplementation((_context: ApplicationContext, consolidationFrom: ConsolidationFrom) => {
        return Promise.resolve(
          MockData.getConsolidationFrom({ override: { ...consolidationFrom } }),
        );
      });

    const actual = await useCase.approveConsolidation(mockContext, approval);
    expect(mockGetConsolidation).toHaveBeenCalled();
    expect(mockCreateCaseHistory.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: pendingConsolidation.childCases[0].caseId,
      }),
    );

    // Verify that createConsolidationTo and createConsolidationFrom are called only for the approved cases
    expect(mockCreateConsolidationTo).toHaveBeenCalledTimes(approval.approvedCases.length);
    expect(mockCreateConsolidationFrom).toHaveBeenCalledTimes(approval.approvedCases.length);

    // Verify that the approved case is included in the calls to createConsolidationTo
    const approvedCaseToCall = mockCreateConsolidationTo.mock.calls.find(
      (call) => call[0].caseId === pendingConsolidation.childCases[0].caseId,
    );
    expect(approvedCaseToCall).toBeDefined();

    // Verify that the approved case is included in the calls to createConsolidationFrom
    const approvedCaseFromCall = mockCreateConsolidationFrom.mock.calls.find(
      (call) => call[0].otherCase.caseId === pendingConsolidation.childCases[0].caseId,
    );
    expect(approvedCaseFromCall).toBeDefined();

    // Verify that the child cases in the AUDIT_CONSOLIDATION document include only the approved cases
    const leadCaseHistory = mockCreateCaseHistory.mock.calls.find(
      (call) => call[0].caseId === leadCase.caseId,
    );
    expect(leadCaseHistory[0].after.childCases).toHaveLength(approval.approvedCases.length);

    // Verify that createTrialAttorneyAssignments is called once for each approved child
    expect(createAssignmentsSpy).toHaveBeenCalledTimes(approval.approvedCases.length);
    approval.approvedCases.forEach((approvedCase) => {
      expect(createAssignmentsSpy).toHaveBeenCalledWith(
        expect.anything(),
        approvedCase,
        leadCaseAssignees,
        CamsRole.TrialAttorney,
        { processRoles: [CamsRole.CaseAssignmentManager] },
      );
    });

    expect(actual).toEqual(expect.arrayContaining([newPendingConsolidation, newConsolidation]));
  });

  test('should identify the user who approved the change', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase,
      consolidationId: pendingConsolidation.id,
      consolidationType: pendingConsolidation.consolidationType,
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
    jest.spyOn(consolidationRepo, 'read').mockResolvedValue(pendingConsolidation);
    const createAssignmentsSpy = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue();

    jest
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation((consolidationOrder: ConsolidationOrder) => {
        return Promise.resolve(
          MockData.getConsolidationOrder({ override: { ...consolidationOrder } }),
        );
      });

    const expectedMap: Map<string, CaseAssignment[]> = new Map();
    const leadCaseAssignments = MockData.buildArray(
      () => MockData.getAttorneyAssignment({ caseId: leadCase.caseId }),
      3,
    );
    const leadCaseAssignees = leadCaseAssignments.map((assignment) => {
      return { id: assignment.userId, name: assignment.name };
    });
    expectedMap.set(leadCase.caseId, leadCaseAssignments);
    pendingConsolidation.childCases.forEach((childCase) => {
      expectedMap.set(
        childCase.caseId,
        MockData.buildArray(() => MockData.getAttorneyAssignment({ caseId: childCase.caseId }), 3),
      );
    });

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

    // Verify that createTrialAttorneyAssignments is called once for each approved child
    expect(createAssignmentsSpy).toHaveBeenCalledTimes(approval.approvedCases.length);
    approval.approvedCases.forEach((approvedCase) => {
      expect(createAssignmentsSpy).toHaveBeenCalledWith(
        expect.anything(),
        approvedCase,
        leadCaseAssignees,
        CamsRole.TrialAttorney,
        { processRoles: [CamsRole.CaseAssignmentManager] },
      );
    });
  });

  test('should identify the user who rejected the change', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder();
    const leadCase = MockData.getCaseSummary();
    const rejection: ConsolidationOrderActionRejection = {
      rejectedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      consolidationId: pendingConsolidation.id,
      reason: 'reject reason',
    };
    const newConsolidation = {
      ...pendingConsolidation,
      leadCase: leadCase,
      id: crypto.randomUUID(),
    };

    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(pendingConsolidation);
    jest.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue(newConsolidation);
    const mockCreateCaseHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();
    jest.spyOn(consolidationRepo, 'delete').mockResolvedValue({});
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockRejectedValue(new Error('should not be called'));
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
