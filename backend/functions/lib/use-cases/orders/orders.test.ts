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
import { TransferOrder, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { TransferIn, TransferOut } from '../../../../../common/src/cams/events';
import { CASE_SUMMARIES } from '../../testing/mock-data/case-summaries.mock';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { CasesLocalGateway } from '../../adapters/gateways/mock.cases.gateway';
import { CaseSummary } from '../../../../../common/src/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { NotFoundError } from '../../common-errors/not-found-error';
import { sortDates } from '../../../../../common/src/date-helper';

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
      caseId: order.caseId,
      newCase: order.newCase,
      status: 'approved',
    };

    const transferIn: TransferIn = {
      caseId: order.newCase.caseId,
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

    const updateOrderFn = jest
      .spyOn(ordersRepo, 'updateOrder')
      .mockResolvedValue({ id: 'mock-guid' });
    const getOrderFn = jest.spyOn(ordersRepo, 'getOrder').mockResolvedValue(order);
    const transferOutFn = jest.spyOn(casesRepo, 'createTransferOut');
    const transferInFn = jest.spyOn(casesRepo, 'createTransferIn');
    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory');

    await useCase.updateTransferOrder(mockContext, order.id, action);
    expect(updateOrderFn).toHaveBeenCalledWith(mockContext, order.id, action);
    expect(getOrderFn).toHaveBeenCalledWith(mockContext, order.id, order.caseId);
    expect(transferOutFn).toHaveBeenCalledWith(mockContext, transferOut);
    expect(transferInFn).toHaveBeenCalledWith(mockContext, transferIn);
    expect(auditFn).toHaveBeenCalled();
  });

  test('should add audit records when a transfer order is rejected', async () => {
    const order: TransferOrder = MockData.getTransferOrder({ override: { status: 'rejected' } });
    const orderTransfer: TransferOrderAction = {
      id: order.id,
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
    const startState = { documentType: 'ORDERS_SYNC_STATE', txId: '1234', id: 'guid-1' };

    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [startState],
    });

    jest.spyOn(MockOrdersGateway.prototype, 'getOrderSync').mockResolvedValue({
      consolidations,
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
        consolidations,
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

  test('should approve a consolidation order', () => {});
  test('should approve a split consolidation order', () => {});
  test('should reject a consolidation order', () => {});
  test('should reject a split consolidation order', () => {});
});
