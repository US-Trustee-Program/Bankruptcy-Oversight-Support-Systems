import { LocalCasesRepository } from '../../testing/local-data/local-cases-repository';
import { LocalConsolidationOrdersRepository } from '../../testing/local-data/local-consolidation-orders-repository';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
} from '../../../../../common/src/cams/orders';
import { OrdersUseCase } from './orders';

import * as FactoryModule from '../../factory';
import { CasesRepository, ConsolidationOrdersRepository } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { ConsolidationFrom, ConsolidationTo } from '../../../../../common/src/cams/events';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import {
  getCasesGateway,
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
} from '../../factory';

// TODO: This could be a testing library functions.
function setupCasesRepoMock(repo: CasesRepository) {
  jest
    .spyOn(FactoryModule, 'getCasesRepository')
    .mockImplementation((_context: ApplicationContext): CasesRepository => {
      return repo;
    });
  return {
    createCaseHistory: jest.spyOn(repo, 'createCaseHistory'),
    createConsolidationTo: jest.spyOn(repo, 'createConsolidationTo'),
    createConsolidationFrom: jest.spyOn(repo, 'createConsolidationFrom'),
    getConsolidation: jest.spyOn(repo, 'getConsolidation'),
    getCaseHistory: jest.spyOn(repo, 'getCaseHistory'),
    createTransferFrom: jest.spyOn(repo, 'createTransferFrom'),
    createTransferTo: jest.spyOn(repo, 'createTransferTo'),
    getTransfers: jest.spyOn(repo, 'getTransfers'),
  };
}

// TODO: This could be a testing library functions.
function setupConsolidationsRepoMock(repo: ConsolidationOrdersRepository) {
  jest
    .spyOn(FactoryModule, 'getConsolidationOrdersRepository')
    .mockImplementation((_context: ApplicationContext): ConsolidationOrdersRepository => {
      return repo;
    });
  return {
    put: jest.spyOn(repo, 'put'),
    delete: jest.spyOn(repo, 'delete'),
  };
}

const leadCase1 = '081-22-12345';
const consolidation1ChildA = '081-23-35256';
const consolidation1ChildB = '081-23-38972';
const consolidation1ChildC = '081-23-38935';
const leadCase = MockData.getCaseSummary({ override: { caseId: leadCase1 } });
const childCase1 = MockData.getConsolidatedOrderCase({
  override: { caseId: consolidation1ChildA },
});
const childCase2 = MockData.getConsolidatedOrderCase({
  override: { caseId: consolidation1ChildB },
});
const childCase3 = MockData.getConsolidatedOrderCase({
  override: { caseId: consolidation1ChildC },
});
const childCases = [childCase1, childCase2, childCase3];

const approvedConsolidation = MockData.getConsolidationOrder({
  override: { status: 'approved', childCases, leadCase },
});

const pendingConsolidation = MockData.getConsolidationOrder({
  override: { status: 'pending', childCases },
});

// TODO: This could be a library function to setup a repo, be it local or cosmos.
async function setupConsolidationCaseReferences(
  context: ApplicationContext,
  repo: CasesRepository,
  order: ConsolidationOrder,
): Promise<CasesRepository> {
  for (const childCase of order.childCases) {
    await repo.createConsolidationTo(
      context,
      MockData.getConsolidationReference({
        override: {
          documentType: 'CONSOLIDATION_TO',
          caseId: childCase.caseId,
          otherCase: order.leadCase,
        },
      }) as ConsolidationTo,
    );
    await repo.createConsolidationFrom(
      context,
      MockData.getConsolidationReference({
        override: {
          documentType: 'CONSOLIDATION_FROM',
          caseId: order.leadCase.caseId,
          otherCase: childCase,
        },
      }) as ConsolidationFrom,
    );
  }
  return repo;
}

// TODO: This could be a library function to setup a repo, be it local or cosmos.
async function setupConsolidationOrder(
  context: ApplicationContext,
  repo: ConsolidationOrdersRepository,
  order: ConsolidationOrder,
): Promise<ConsolidationOrdersRepository> {
  await repo.put(context, order);
  return repo;
}

describe('orders use case tests', () => {
  let mockContext;
  let ordersGateway;
  let ordersRepo;
  let runtimeStateRepo;
  let casesGateway;

  beforeEach(async () => {
    mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    ordersGateway = getOrdersGateway(mockContext);
    runtimeStateRepo = getRuntimeStateRepository(mockContext);
    ordersRepo = getOrdersRepository(mockContext);
    casesGateway = getCasesGateway(mockContext);
  });

  test('should not create a second lead case for an existing consolidation', async () => {
    // Spy/mock the factory functions so we can return a LOCAL database of our choosing for the test.
    // We need a generic LOCAL gateway implementation that we return via the mocked factory function.
    const localCasesRepo = new LocalCasesRepository();
    const localConsolidationsRepo = new LocalConsolidationOrdersRepository();

    await setupConsolidationCaseReferences(mockContext, localCasesRepo, approvedConsolidation);
    await setupConsolidationOrder(mockContext, localConsolidationsRepo, approvedConsolidation);
    await setupConsolidationOrder(mockContext, localConsolidationsRepo, pendingConsolidation);

    // Do not add the mock until the local data has been setup.
    const casesRepoSpy = setupCasesRepoMock(localCasesRepo);
    const consolidationSpy = setupConsolidationsRepoMock(localConsolidationsRepo);
    const useCase = new OrdersUseCase(
      localCasesRepo,
      casesGateway,
      ordersRepo,
      ordersGateway,
      runtimeStateRepo,
      localConsolidationsRepo,
    );

    // attempt to set up a consolidation with a different lead case
    const incorrectLeadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      ...pendingConsolidation,
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase: incorrectLeadCase,
    };

    const expectedErrorMessage =
      'Cannot consolidate order. A child case has already been consolidated.';
    await expect(useCase.approveConsolidation(mockContext, approval)).rejects.toThrow(
      expectedErrorMessage,
    );

    // verify that the attempt fails (hint, it won't currently)
    expect(consolidationSpy.put).not.toHaveBeenCalled();
    expect(consolidationSpy.delete).not.toHaveBeenCalled();
    expect(casesRepoSpy.createCaseHistory).not.toHaveBeenCalled();
    expect(casesRepoSpy.createConsolidationTo).not.toHaveBeenCalled();
    expect(casesRepoSpy.createConsolidationFrom).not.toHaveBeenCalled();
  });

  test('should not consolidate a case that has already been consolidated', () => {});
});
