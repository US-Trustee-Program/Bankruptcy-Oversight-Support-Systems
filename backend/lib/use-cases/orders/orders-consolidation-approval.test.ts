import * as crypto from 'crypto';

import { SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';
import { CaseHistory, ConsolidationOrderSummary } from '../../../../common/src/cams/history';
import {
  ConsolidationOrderActionApproval,
  getCaseSummaryFromConsolidationOrderCase,
} from '../../../../common/src/cams/orders';
import { CamsRole } from '../../../../common/src/cams/roles';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCasesRepository } from '../../factory';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import { OrdersUseCase } from './orders';

describe('Orders use case', () => {
  let mockContext;
  let casesRepo;
  let useCase: OrdersUseCase;
  const courtDivisionCode = '081';
  const authorizedUser = MockData.getCamsUser({
    offices: [REGION_02_GROUP_NY],
    roles: [CamsRole.DataVerifier],
  });

  beforeEach(async () => {
    mockContext = await createMockApplicationContext();
    mockContext.session = await createMockApplicationContextSession({ user: authorizedUser });
    casesRepo = getCasesRepository(mockContext);
    useCase = new OrdersUseCase(mockContext);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // TODO: Why does the order of these tests determine if 1 passes?  How are they trampling on each other?
  test('should approve a split consolidation order', async () => {
    const originalConsolidation = MockData.getConsolidationOrder({
      override: {
        courtDivisionCode,
        status: 'approved',
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
      id: crypto.randomUUID(),
      leadCase: leadCaseSummary,
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
      childCases: [],
      status: 'pending',
    };
    const childCaseSummaries = approvedConsolidation.childCases.map((bCase) =>
      getCaseSummaryFromConsolidationOrderCase(bCase),
    );
    const leadCaseAfter: ConsolidationOrderSummary = {
      childCases: [childCaseSummaries[0]],
      status: 'approved',
    };
    const leadCaseHistory: Partial<CaseHistory> = {
      after: leadCaseAfter,
      before: leadCaseBefore,
      caseId: approvedConsolidation.leadCase.caseId,
      documentType: 'AUDIT_CONSOLIDATION',
    };
    const before: ConsolidationOrderSummary = {
      childCases: [],
      status: 'pending',
    };
    const after: ConsolidationOrderSummary = {
      childCases: [],
      leadCase: approvedConsolidation.leadCase,
      status: 'approved',
    };
    const childCaseHistory: Partial<CaseHistory> = {
      after,
      before,
      caseId: originalConsolidation.childCases[0].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
    };
    const initialCaseHistory: CaseHistory = {
      after: before,
      before: null,
      caseId: originalConsolidation.childCases[0].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01T12:00:00.000Z',
    };
    const mockGetHistory = jest
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });
    const mockCreateHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();

    const _mockGetConsolidation = jest
      .spyOn(MockMongoRepository.prototype, 'getConsolidation')
      .mockImplementation(async () => {
        return [];
      });

    jest.spyOn(MockMongoRepository.prototype, 'update').mockResolvedValue(undefined);

    jest.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue(undefined);

    jest
      .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
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
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue();

    const actual = await useCase.approveConsolidation(mockContext, approval);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalled();
    expect(mockCreateHistory.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        ...childCaseHistory,
        caseId: originalConsolidation.childCases[0].caseId,
      }),
    );
    expect(mockCreateHistory.mock.calls[1][0]).toEqual(expect.objectContaining(leadCaseHistory));

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
      id: crypto.randomUUID(),
      leadCase: leadCaseSummary,
    };

    const mockPut = jest
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockResolvedValue(newConsolidation);

    const leadCaseBefore: ConsolidationOrderSummary = {
      childCases: [],
      status: 'pending',
    };

    const childCaseSummaries = newConsolidation.childCases.map((bCase) =>
      getCaseSummaryFromConsolidationOrderCase(bCase),
    );

    const leadCaseAfter: ConsolidationOrderSummary = {
      childCases: childCaseSummaries,
      status: 'approved',
    };

    const leadCaseHistory: Partial<CaseHistory> = {
      after: leadCaseAfter,
      before: leadCaseBefore,
      caseId: newConsolidation.leadCase.caseId,
      documentType: 'AUDIT_CONSOLIDATION',
    };

    const before: ConsolidationOrderSummary = {
      childCases: [],
      status: 'pending',
    };

    const after: ConsolidationOrderSummary = {
      childCases: [],
      leadCase: newConsolidation.leadCase,
      status: 'approved',
    };

    const childCaseHistory: Partial<CaseHistory> = {
      after,
      before,
      caseId: pendingConsolidation.childCases[0].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
    };

    const initialCaseHistory: CaseHistory = {
      after: before,
      before: null,
      caseId: pendingConsolidation.childCases[0].caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01T12:00:00.000Z',
    };

    const mockGetHistory = jest
      .spyOn(MockMongoRepository.prototype, 'getCaseHistory')
      .mockImplementation((_context: ApplicationContext, caseId: string) => {
        return Promise.resolve([{ ...initialCaseHistory, caseId }]);
      });

    const mockCreateHistory = jest
      .spyOn(MockMongoRepository.prototype, 'createCaseHistory')
      .mockResolvedValue();

    const mockCreateAssignment = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue();

    const mockGetConsolidation = jest.spyOn(casesRepo, 'getConsolidation').mockResolvedValue([]);

    jest
      .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
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
