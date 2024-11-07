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
import * as crypto from 'crypto';
import { CaseHistory, ConsolidationOrderSummary } from '../../../../../common/src/cams/history';
import { CaseAssignmentUseCase } from '../case-assignment';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { SYSTEM_USER_REFERENCE } from '../../../../../common/src/cams/auditable';
import { REGION_02_GROUP_NY } from '../../../../../common/src/cams/test-utilities/mock-user';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

describe('Orders use case', () => {
  let mockContext;
  let ordersGateway;
  let ordersRepo;
  let casesRepo;
  let runtimeStateRepo;
  let casesGateway;
  let consolidationRepo;
  let useCase: OrdersUseCase;
  const courtDivisionCode = '081';
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

  // TODO: Why does the order of these tests determine if 1 passes?  How are they trampling on each other?
  test('should approve a split consolidation order', async () => {
    const originalConsolidation = MockData.getConsolidationOrder({
      override: {
        status: 'approved',
        courtDivisionCode,
      },
    });
    const mockDelete = jest.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue();
    const leadCaseSummary = MockData.getCaseSummary({ override: { courtDivisionCode } });
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
      .spyOn(MockMongoRepository.prototype, 'create')
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
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });
    const mockCreateHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue(crypto.randomUUID());

    const _mockGetConsolidation = jest
      .spyOn(MockMongoRepository.prototype, 'getConsolidation')
      .mockImplementation(async () => {
        return [];
      });

    jest.spyOn(MockMongoRepository.prototype, 'update').mockResolvedValue();

    jest.spyOn(MockMongoRepository.prototype, 'create')..mockResolvedValue();

    jest
      .spyOn(MockMongoRepository.prototype, 'findAssignmentsByCaseId')
      .mockImplementation((ids: string[]) => {
        const assignmentsMap = new Map();
        ids.forEach((id) => {
          assignmentsMap.set(id, [MockData.getAttorneyAssignment({ id })]);
        });
        return Promise.resolve(assignmentsMap);
      });
    jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationTo')
      .mockResolvedValue(MockData.getConsolidationTo({ override: { otherCase: leadCaseSummary } }));
    jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationFrom')
      .mockResolvedValue(
        MockData.getConsolidationFrom({ override: { otherCase: childCaseSummaries[0] } }),
      );

    const actual = await useCase.approveConsolidation(mockContext, approval);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalled();
    expect(mockCreateHistory.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: originalConsolidation.childCases[0].caseId,
      }),
    );
    expect(mockCreateHistory.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        caseId: originalConsolidation.childCases[0].caseId,
        documentType: 'AUDIT_ASSIGNMENT',
        updatedBy: expect.anything(),
        before: expect.anything(),
        after: expect.anything(),
      }),
    );
    expect(mockCreateHistory.mock.calls[2][0]).toEqual(expect.objectContaining(leadCaseHistory));

    expect(mockGetHistory).toHaveBeenCalledTimes(approval.approvedCases.length + 1);
    expect(actual).toEqual([newPendingConsolidation, approvedConsolidation]);
  });

  test('should approve a consolidation order', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder({
      override: {
        status: 'approved',
      },
    });

    const mockDelete = jest.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue();

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
      .spyOn(MockMongoRepository.prototype, 'create')
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
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });

    const mockCreateHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue('');

    const mockCreateAssignment = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue();

    const mockGetConsolidation = jest.spyOn(casesRepo, 'getConsolidation').mockResolvedValue([]);

    jest
      .spyOn(MockMongoRepository.prototype, 'findAssignmentsByCaseId')
      .mockResolvedValue(new Map());
    jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationTo')
      .mockResolvedValue(MockData.getConsolidationTo());
    jest
      .spyOn(MockMongoRepository.prototype, 'createConsolidationFrom')
      .mockResolvedValue(MockData.getConsolidationFrom());

    const actual = await useCase.approveConsolidation(mockContext, approval);
    expect(mockGetConsolidation).toHaveBeenCalledTimes(approval.childCases.length + 1);
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
    expect(mockCreateHistory.mock.calls[2][0]).toEqual(expect.objectContaining(leadCaseHistory));
    expect(mockGetHistory).toHaveBeenCalledTimes(pendingConsolidation.childCases.length + 1);
    expect(mockCreateAssignment).toHaveBeenCalledTimes(pendingConsolidation.childCases.length);
    expect(actual).toEqual([newConsolidation]);
  });
});
