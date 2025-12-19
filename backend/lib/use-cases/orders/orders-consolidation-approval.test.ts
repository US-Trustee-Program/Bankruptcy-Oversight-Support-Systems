import { vi } from 'vitest';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import { getCasesRepository } from '../../factory';
import {
  ConsolidationOrderActionApproval,
  getCaseSummaryFromConsolidationOrderCase,
} from '../../../../common/src/cams/orders';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import * as crypto from 'crypto';
import { CaseHistory, ConsolidationOrderSummary } from '../../../../common/src/cams/history';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import { CamsRole } from '../../../../common/src/cams/roles';
import { SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

describe('Orders use case', () => {
  let mockContext;
  let casesRepo;
  let useCase: OrdersUseCase;
  const courtDivisionCode = '081';
  const authorizedUser = MockData.getCamsUser({
    roles: [CamsRole.DataVerifier],
    offices: [REGION_02_GROUP_NY],
  });

  beforeEach(async () => {
    mockContext = await createMockApplicationContext();
    mockContext.session = await createMockApplicationContextSession({ user: authorizedUser });
    casesRepo = getCasesRepository(mockContext);
    useCase = new OrdersUseCase(mockContext);

    vi.spyOn(MockMongoRepository.prototype, 'count').mockResolvedValue(0);
    vi.spyOn(MockMongoRepository.prototype, 'create').mockImplementation((order) =>
      Promise.resolve(order),
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // TODO: Why does the order of these tests determine if 1 passes?  How are they trampling on each other?
  test('should approve a split consolidation order', async () => {
    const originalConsolidation = MockData.getConsolidationOrder({
      override: {
        courtDivisionCode,
      },
    });
    originalConsolidation.childCases.push(
      MockData.getConsolidatedOrderCase({
        override: { courtDivisionCode },
      }),
    );
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(originalConsolidation);

    const leadCaseSummary = MockData.getCaseSummary({ override: { courtDivisionCode } });
    const approval: ConsolidationOrderActionApproval = {
      ...originalConsolidation,
      consolidationType: originalConsolidation.consolidationType,
      approvedCases: [
        originalConsolidation.childCases[0].caseId,
        originalConsolidation.childCases[1].caseId,
      ],
      leadCase: leadCaseSummary,
    };

    const approvedConsolidation = {
      ...originalConsolidation,
      childCases: [originalConsolidation.childCases[0], originalConsolidation.childCases[1]],
      leadCase: leadCaseSummary,
      id: crypto.randomUUID(),
      status: 'approved',
    };
    const newPendingConsolidation = {
      ...originalConsolidation,
      childCases: [originalConsolidation.childCases[2]],
    };

    const mockUpdate = vi
      .spyOn(MockMongoRepository.prototype, 'update')
      .mockResolvedValueOnce(newPendingConsolidation);

    const mockCreate = vi
      .spyOn(MockMongoRepository.prototype, 'create')
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
      childCases: [childCaseSummaries[0], childCaseSummaries[1]],
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
    const mockGetHistory = vi
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });
    const mockCreateHistory = vi
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();

    const _mockGetConsolidation = vi
      .spyOn(MockMongoRepository.prototype, 'getConsolidation')
      .mockImplementation(async () => {
        return [];
      });

    vi.spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases').mockImplementation(
      (ids: string[]) => {
        const assignmentsMap = new Map();
        ids.forEach((id) => {
          assignmentsMap.set(id, [MockData.getAttorneyAssignment({ id })]);
        });
        return Promise.resolve(assignmentsMap);
      },
    );
    vi.spyOn(MockMongoRepository.prototype, 'createConsolidationTo').mockResolvedValue(
      MockData.getConsolidationTo({ override: { otherCase: leadCaseSummary } }),
    );
    vi.spyOn(MockMongoRepository.prototype, 'createConsolidationFrom').mockResolvedValue(
      MockData.getConsolidationFrom({ override: { otherCase: childCaseSummaries[0] } }),
    );
    vi.spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments').mockResolvedValue();

    const actual = await useCase.approveConsolidation(mockContext, approval);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
    expect(mockCreateHistory.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: originalConsolidation.childCases[0].caseId,
      }),
    );
    expect(mockCreateHistory.mock.calls[2][0]).toEqual(expect.objectContaining(leadCaseHistory));

    expect(mockGetHistory).toHaveBeenCalledTimes(approval.approvedCases.length + 1);
    expect(actual).toEqual([approvedConsolidation, newPendingConsolidation]);
  });

  test('should approve a consolidation order', async () => {
    const pendingConsolidation = MockData.getConsolidationOrder({
      override: {
        status: 'approved',
      },
    });

    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(pendingConsolidation);
    const mockDelete = vi.spyOn(MockMongoRepository.prototype, 'delete').mockResolvedValue();

    const leadCaseSummary = MockData.getCaseSummary();
    const approval: ConsolidationOrderActionApproval = {
      consolidationId: pendingConsolidation.consolidationId,
      consolidationType: pendingConsolidation.consolidationType,
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

    const mockPut = vi
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

    const mockGetHistory = vi
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });

    const mockCreateHistory = vi
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();

    const mockCreateAssignment = vi
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue();

    const mockGetConsolidation = vi.spyOn(casesRepo, 'getConsolidation').mockResolvedValue([]);

    vi.spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases').mockResolvedValue(new Map());
    vi.spyOn(MockMongoRepository.prototype, 'createConsolidationTo').mockResolvedValue(
      MockData.getConsolidationTo(),
    );
    vi.spyOn(MockMongoRepository.prototype, 'createConsolidationFrom').mockResolvedValue(
      MockData.getConsolidationFrom(),
    );

    const actual = await useCase.approveConsolidation(mockContext, approval);
    expect(mockGetConsolidation).toHaveBeenCalledTimes(pendingConsolidation.childCases.length + 1);
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
