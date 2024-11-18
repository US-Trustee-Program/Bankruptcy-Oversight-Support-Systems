import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
} from '../../../../../common/src/cams/orders';

import { Factory } from '../../factory';
import { CasesRepository, ConsolidationOrdersRepository } from '../gateways.types';
import { ConsolidationFrom, ConsolidationTo } from '../../../../../common/src/cams/events';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { REGION_02_GROUP_NY } from '../../../../../common/src/cams/test-utilities/mock-user';
import { LocalCasesRepository } from '../../testing/local-data/local-cases-repository';
import { LocalConsolidationOrdersRepository } from '../../testing/local-data/local-consolidation-orders-repository';
import { OrdersUseCase } from './orders';

function setupCasesRepoMock(repo: CasesRepository) {
  jest.spyOn(Factory, 'getCasesRepository').mockReturnValue(repo);
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

function setupConsolidationsRepoMock(repo: ConsolidationOrdersRepository) {
  jest.spyOn(Factory, 'getConsolidationOrdersRepository').mockReturnValue(repo);
  return {
    put: jest.spyOn(repo, 'create'),
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
  repo: CasesRepository,
  order: ConsolidationOrder,
): Promise<CasesRepository> {
  for (const childCase of order.childCases) {
    await repo.createConsolidationTo(
      MockData.getConsolidationReference({
        override: {
          documentType: 'CONSOLIDATION_TO',
          caseId: childCase.caseId,
          otherCase: order.leadCase,
        },
      }) as ConsolidationTo,
    );
    await repo.createConsolidationFrom(
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
  repo: ConsolidationOrdersRepository,
  order: ConsolidationOrder,
): Promise<ConsolidationOrdersRepository> {
  await repo.create(order);
  return repo;
}

describe('orders use case tests', () => {
  let mockContext;

  const authorizedUser = MockData.getCamsUser({
    roles: [CamsRole.DataVerifier],
    offices: [REGION_02_GROUP_NY],
  });

  beforeEach(async () => {
    mockContext = await createMockApplicationContext();
    mockContext.session = await createMockApplicationContextSession({ user: authorizedUser });
  });

  test.only('should not create a second lead case for an existing consolidation', async () => {
    // Spy/mock the factory functions so we can return a LOCAL database of our choosing for the test.
    // We need a generic LOCAL gateway implementation that we return via the mocked factory function.
    const localCasesRepo = new LocalCasesRepository();
    const localConsolidationsRepo = new LocalConsolidationOrdersRepository();

    await setupConsolidationCaseReferences(localCasesRepo, approvedConsolidation);
    await setupConsolidationOrder(localConsolidationsRepo, approvedConsolidation);
    await setupConsolidationOrder(localConsolidationsRepo, pendingConsolidation);

    // Do not add the mock until the local data has been setup.
    const casesRepoSpy = setupCasesRepoMock(localCasesRepo);
    const consolidationSpy = setupConsolidationsRepoMock(localConsolidationsRepo);

    const useCase = new OrdersUseCase(mockContext);

    // attempt to set up a consolidation with a different lead case
    const incorrectLeadCase = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      ...pendingConsolidation,
      approvedCases: pendingConsolidation.childCases.map((bCase) => {
        return bCase.caseId;
      }),
      leadCase: incorrectLeadCase,
    };

    await expect(useCase.approveConsolidation(mockContext, approval)).rejects.toThrow(
      'Cannot consolidate order. A child case has already been consolidated.',
    );

    // verify that the attempt fails (hint, it won't currently)
    expect(consolidationSpy.put).not.toHaveBeenCalled();
    expect(consolidationSpy.delete).not.toHaveBeenCalled();
    expect(casesRepoSpy.createCaseHistory).not.toHaveBeenCalled();
    expect(casesRepoSpy.createConsolidationTo).not.toHaveBeenCalled();
    expect(casesRepoSpy.createConsolidationFrom).not.toHaveBeenCalled();
  });
});
