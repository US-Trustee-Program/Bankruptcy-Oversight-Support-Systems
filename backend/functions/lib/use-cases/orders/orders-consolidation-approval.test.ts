import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import {
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
  getCasesRepository,
  getCasesGateway,
  getConsolidationOrdersRepository,
} from '../../factory';
import {
  ConsolidationOrderActionApproval,
  getCaseSummaryFromConsolidationOrderCase,
} from '../../../../../common/src/cams/orders';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { CosmosDbRepository } from '../../adapters/gateways/cosmos/cosmos.repository';
import { CasesCosmosDbRepository } from '../../adapters/gateways/cases.cosmosdb.repository';
import * as crypto from 'crypto';
import { CaseHistory, ConsolidationOrderSummary } from '../../../../../common/src/cams/history';
import { CaseAssignmentUseCase } from '../case-assignment';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { SYSTEM_USER_REFERENCE } from '../../../../../common/src/cams/auditable';
import { REGION_02_GROUP_NY } from '../../../../../common/src/cams/test-utilities/mock-user';

describe('Orders use case', () => {
  let mockContext;
  let ordersGateway;
  let ordersRepo;
  let casesRepo;
  let runtimeStateRepo;
  let casesGateway;
  let consolidationRepo;
  let useCase: OrdersUseCase;
  const authorizedUser = MockData.getCamsUser({
    roles: [CamsRole.DataVerifier],
    offices: [REGION_02_GROUP_NY],
  });

  beforeEach(async () => {
    mockContext = await createMockApplicationContext();
    mockContext.session = await createMockApplicationContextSession({ user: authorizedUser });
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

  afterEach(() => {
    jest.resetAllMocks();
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
      updatedOn: '2024-01-01T12:00:00.000Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    const mockGetHistory = jest
      .spyOn(CasesCosmosDbRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });

    const mockCreateHistory = jest
      .spyOn(CasesCosmosDbRepository.prototype, 'createCaseHistory')
      .mockResolvedValue(crypto.randomUUID());

    const mockCreateAssignment = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue();

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
    expect(mockCreateHistory.mock.calls[2][1]).toEqual(expect.objectContaining(leadCaseHistory));
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
      updatedOn: '2024-01-01T12:00:00.000Z',
      updatedBy: SYSTEM_USER_REFERENCE,
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
});
