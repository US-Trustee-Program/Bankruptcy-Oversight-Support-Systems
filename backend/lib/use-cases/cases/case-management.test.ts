import { vi } from 'vitest';
import CaseManagement, { getAction } from './case-management';
import { CamsError } from '../../common-errors/cams-error';
import MockData from '@common/cams/test-utilities/mock-data';
import { CaseAssignment } from '@common/cams/assignments';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import factory from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsUser } from '@common/cams/users';
import { REGION_02_GROUP_BU, REGION_02_GROUP_NY } from '@common/cams/test-utilities/mock-user';
import { ustpOfficeToCourtDivision } from '@common/cams/courts';
import { buildOfficeCode } from '../offices/offices';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TransferOrder } from '@common/cams/orders';
import { ConsolidationTo } from '@common/cams/events';
import { CasesSearchPredicate } from '@common/api/search';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import { ObservabilityGateway } from '../gateways.types';

async function createCaseManagementTestContext(options: {
  user: CamsUser;
  phoneticSearchEnabled?: boolean;
  phoneticSimilarityThreshold?: string;
  env?: Record<string, string>;
}) {
  const { user, phoneticSearchEnabled = false, phoneticSimilarityThreshold, env = {} } = options;

  const baseEnv: Record<string, string> = {
    STARTING_MONTH: '-6',
    ...env,
  };

  if (phoneticSearchEnabled) {
    baseEnv.PHONETIC_SEARCH_ENABLED = 'true';
    if (phoneticSimilarityThreshold) {
      baseEnv.PHONETIC_SIMILARITY_THRESHOLD = phoneticSimilarityThreshold;
    }
  }

  const context = await createMockApplicationContext({ env: baseEnv });
  context.featureFlags['phonetic-search-enabled'] = phoneticSearchEnabled;
  context.session = await createMockApplicationContextSession({ user });

  const useCase = new CaseManagement(context);

  return { context, useCase };
}

const attorneyJaneSmith = { id: '001', name: 'Jane Smith' };
const attorneyJoeNobel = { id: '002', name: 'Joe Nobel' };
const currentDate = new Date().toISOString();
const assignments: CaseAssignment[] = [
  {
    documentType: 'ASSIGNMENT',
    id: '1',
    caseId: '081-23-01176',
    userId: attorneyJaneSmith.id,
    name: attorneyJaneSmith.name,
    role: CamsRole.TrialAttorney,
    assignedOn: currentDate,
    updatedOn: currentDate,
    updatedBy: MockData.getCamsUserReference(),
  },
  {
    documentType: 'ASSIGNMENT',
    id: '2',
    caseId: '081-23-01176',
    userId: attorneyJoeNobel.id,
    name: attorneyJoeNobel.name,
    role: CamsRole.TrialAttorney,
    assignedOn: currentDate,
    updatedOn: currentDate,
    updatedBy: MockData.getCamsUserReference(),
  },
];

const caseIdWithAssignments = '081-23-01176';
const assignmentMap = new Map([[caseIdWithAssignments, assignments]]);

describe('Case management tests', () => {
  let applicationContext: ApplicationContext;
  let useCase: CaseManagement;
  const userOffice = MockData.randomUstpOffice();
  const user: CamsUser = {
    id: 'userId-Mock Name',
    name: 'Mock Name',
    offices: [userOffice],
    roles: [CamsRole.CaseAssignmentManager],
  };
  let mockTransfers: TransferOrder[];
  let mockConsolidations: ConsolidationTo[];

  beforeEach(() => {
    mockTransfers = MockData.buildArray(MockData.getTransferOrder, 2);
    mockConsolidations = [MockData.getConsolidationTo()];
    vi.spyOn(MockMongoRepository.prototype, 'getTransfers').mockResolvedValue(mockTransfers);
    vi.spyOn(MockMongoRepository.prototype, 'getConsolidation').mockResolvedValue(
      mockConsolidations,
    );
  });

  beforeAll(async () => {
    applicationContext = await createMockApplicationContext({
      env: {
        STARTING_MONTH: '-6',
      },
    });
    applicationContext.session = await createMockApplicationContextSession({ user });
    useCase = new CaseManagement(applicationContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor tests', () => {
    test('should always set casesRepo and officesGateway', () => {
      const casesGateway = factory.getCasesGateway(applicationContext);

      const basic = new CaseManagement(applicationContext);
      const withOptionalParams = new CaseManagement(applicationContext, casesGateway);

      expect(basic.casesGateway).toBeDefined();
      expect(withOptionalParams.casesGateway).toBeDefined();
    });
  });

  describe('getAction tests', () => {
    test('should return post action if user has office with correct division code and Case Assignment Manager role', async () => {
      const courtOffices = ustpOfficeToCourtDivision(applicationContext.session.user.offices[0]);
      const officeDetail = courtOffices[0];
      const caseNumber = '00-00000';
      const bCase = MockData.getCaseDetail({
        override: {
          ...officeDetail,
          caseId: '999-' + caseNumber,
        },
      });
      const expectedActions = [
        {
          actionName: 'manage assignments',
          method: 'POST',
          path: `/case-assignments/${bCase.caseId}`,
        },
      ];

      const actual = getAction(applicationContext, bCase);
      expect(actual).toEqual(expectedActions);
    });

    test('should not return post action if the user does not have case assignment role', async () => {
      const user = {
        id: 'userId-Mock Name',
        name: 'Mock Name',
        offices: [userOffice],
        roles: [],
      };
      const { context } = await createCaseManagementTestContext({ user });

      const officeDetail = context.session.user.offices[0];
      const caseNumber = '00-00000';
      const bCase = MockData.getCaseDetail({
        override: {
          ...officeDetail,
          caseId: '999-' + caseNumber,
        },
      });

      const actual = getAction(context, bCase);
      expect(actual).toEqual([]);
    });

    test('should not return post action if the user does not have correct office assigned', async () => {
      const user = {
        id: 'userId-Mock Name',
        name: 'Mock Name',
        offices: [],
        roles: [CamsRole.CaseAssignmentManager],
      };
      const { context } = await createCaseManagementTestContext({ user });

      const officeDetail = context.session.user.offices[0];
      const caseNumber = '00-00000';
      const bCase = MockData.getCaseDetail({
        override: {
          ...officeDetail,
          caseId: '999-' + caseNumber,
        },
      });

      const actual = getAction(context, bCase);
      expect(actual).toEqual([]);
    });
  });

  describe('Case detail tests', () => {
    test('Should return a properly formatted case when a case number is supplied', async () => {
      const caseId = caseIdWithAssignments;
      const dateFiled = '2018-11-16';
      const closedDate = '2019-06-21';

      const caseDetail = MockData.getCaseDetail({
        override: {
          caseId,
          dateFiled,
          closedDate,
        },
      });

      vi.spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId').mockResolvedValue(
        assignmentMap,
      );

      const chapterCaseList = new CaseManagement(applicationContext);
      vi.spyOn(chapterCaseList.casesGateway, 'getCaseDetail').mockImplementation(async () => {
        return Promise.resolve(caseDetail);
      });

      vi.spyOn(chapterCaseList.casesGateway, 'getCaseDetail').mockResolvedValue(caseDetail);

      const actualCaseDetail = await chapterCaseList.getCaseDetail(applicationContext, caseId);

      expect(actualCaseDetail.caseId).toEqual(caseId);
      expect(actualCaseDetail.dateFiled).toEqual(dateFiled);
      expect(actualCaseDetail.closedDate).toEqual(closedDate);
      expect(actualCaseDetail.assignments).toEqual(assignments);
    });

    test('should include case assignment action if the user has case assignment role', async () => {
      const officeName = 'Test Office';
      const courtOffices = ustpOfficeToCourtDivision(applicationContext.session.user.offices[0]);
      const officeDetail = courtOffices[0];

      const bCase = MockData.getCaseDetail({
        override: {
          ...officeDetail,
          caseId: caseIdWithAssignments,
        },
      });

      vi.spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId').mockResolvedValue(
        assignmentMap,
      );
      vi.spyOn(useCase.officesGateway, 'getOfficeName').mockReturnValue(officeName);
      const _actions = [
        {
          actionName: 'manage assignments',
          method: 'POST',
          path: `/case-assignments/${bCase.caseId}`,
        },
      ];
      const builtOfficeCode = buildOfficeCode(bCase.regionId, bCase.courtDivisionCode);

      const expected = {
        ...bCase,
        assignments,
        officeName,
        _actions,
        officeCode: builtOfficeCode,
        transfers: mockTransfers,
        consolidation: mockConsolidations,
      };

      vi.spyOn(useCase.casesGateway, 'getCaseDetail').mockResolvedValue(bCase);
      const actual = await useCase.getCaseDetail(applicationContext, bCase.caseId);
      expect(actual).toEqual(expected);
    });

    test('should throw an AssignmentError when CaseAssignmentUseCase.findAssignmentsByCaseId throws an error', async () => {
      const bCase = MockData.getCaseDetail({ override: { caseId: 'ThrowError' } });

      vi.spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId').mockRejectedValue(
        new Error('TestError'),
      );
      vi.spyOn(useCase.casesGateway, 'getCaseDetail').mockResolvedValue(bCase);

      await expect(useCase.getCaseDetail(applicationContext, bCase.caseId)).rejects.toThrow(
        'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
      );
    });
  });

  describe('Case summary tests', () => {
    test('should return summary', async () => {
      const caseSummary = MockData.getCaseSummary({ override: { caseId: '000-00-00000' } });

      const context = await createMockApplicationContext();
      vi.spyOn(useCase.casesGateway, 'getCaseSummary').mockResolvedValue(caseSummary);

      const actual = await useCase.getCaseSummary(context, '000-00-00000');
      expect(actual).toEqual(caseSummary);
    });

    test('should throw CamsError', async () => {
      const error = new Error('some error');
      vi.spyOn(useCase.casesGateway, 'getCaseSummary').mockRejectedValue(error);
      const context = await createMockApplicationContext();
      await expect(useCase.getCaseSummary(context, '000-00-00000')).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'CASE-MANAGEMENT-USE-CASE',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });
  });

  describe('searchCases tests', () => {
    const basePredicate: CasesSearchPredicate = {
      chapters: ['15'],
      excludeMemberConsolidations: false,
    };
    const caseNumber = '00-00000';

    test('should filter for unassigned cases when includeOnlyUnassigned is true', async () => {
      const predicate: CasesSearchPredicate = {
        ...basePredicate,
        includeOnlyUnassigned: true,
      };

      const searchCases = vi
        .spyOn(useCase.casesRepository, 'searchCases')
        .mockResolvedValue({ metadata: { total: 0 }, data: [] });

      await useCase.searchCases(applicationContext, predicate, false);

      expect(searchCases).toHaveBeenCalledWith({
        ...predicate,
        includeOnlyUnassigned: true,
      });
    });

    test('should return an empty array for no matches', async () => {
      vi.spyOn(useCase.casesRepository, 'searchCases').mockResolvedValue({
        metadata: { total: 0 },
        data: [],
      });
      const actual = await useCase.searchCases(applicationContext, { caseNumber }, false);
      expect(actual).toEqual({ metadata: { total: 0 }, data: [] });
    });

    const optionsCases = [
      { caseName: 'NOT get case assignments', includeCaseAssignments: false },
      { caseName: 'GET case assignments', includeCaseAssignments: true },
    ];
    test.each(optionsCases)(`should return a match and $caseName`, async (args) => {
      const assignedCaseIds = MockData.buildArray(MockData.randomCaseId, 3);
      const unassignedCaseId = MockData.randomCaseId();
      const allCaseIds = [...assignedCaseIds, unassignedCaseId];
      const assignmentsMap = assignedCaseIds.reduce<Map<string, CaseAssignment[]>>(
        (map, caseId) => {
          map.set(caseId, [MockData.getAttorneyAssignment({ caseId })]);
          return map;
        },
        new Map<string, CaseAssignment[]>(),
      );
      const cases = allCaseIds.map((caseId) => {
        return MockData.getSyncedCase({ override: { caseId } });
      });
      vi.spyOn(useCase.casesRepository, 'searchCases').mockResolvedValue({
        metadata: { total: cases.length },
        data: cases,
      });
      const assignmentsSpy = vi
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockImplementation(() => {
          if (args.includeCaseAssignments) {
            return Promise.resolve(assignmentsMap);
          } else {
            return Promise.reject('We should not have retrieved assignments.');
          }
        });
      const actual = await useCase.searchCases(
        applicationContext,
        { caseNumber },
        args.includeCaseAssignments,
      );
      const casesWithAssignments = cases.map((bCase) => {
        return { ...bCase, assignments: assignmentsMap.get(bCase.caseId) ?? [] };
      });
      const expectedCases = args.includeCaseAssignments ? casesWithAssignments : cases;
      expect(actual).toEqual({ metadata: { total: cases.length }, data: expectedCases });
      expect(!!assignmentsSpy.mock.calls.length).toEqual(args.includeCaseAssignments);
    });

    test('should return cases and actions for the user', async () => {
      const courtDivisionCode =
        applicationContext.session.user.offices[0].groups[0].divisions[0].divisionCode;
      const bCase = MockData.getCaseSummary({
        override: {
          caseId: '999-' + caseNumber,
          courtDivisionCode,
        },
      });
      const officeCode = buildOfficeCode(bCase.regionId, bCase.courtDivisionCode);
      const _actions = [
        {
          actionName: 'manage assignments',
          method: 'POST',
          path: `/case-assignments/${bCase.caseId}`,
        },
      ];
      const predicate = {
        ...basePredicate,
        excludeMemberConsolidations: true,
      };

      const syncedCase = MockData.getSyncedCase({
        override: {
          ...bCase,
        },
      });
      const expected = [{ ...syncedCase, officeCode, _actions }];
      vi.spyOn(useCase.casesRepository, 'getConsolidationMemberCaseIds').mockResolvedValue([]);
      vi.spyOn(useCase.casesRepository, 'searchCases').mockResolvedValue({
        metadata: { total: 1 },
        data: [syncedCase],
      });
      const actual = await useCase.searchCases(applicationContext, predicate, false);
      expect(actual).toEqual({ metadata: { total: 1 }, data: expected });
    });

    test('should return search cases by assignment', async () => {
      const user = MockData.getCamsUser({ offices: [REGION_02_GROUP_NY, REGION_02_GROUP_BU] });
      const caseIds = ['081-00-12345', '081-11-23456', '091-12-34567'];
      const assignments = caseIds.map((caseId) => MockData.getAttorneyAssignment({ caseId }));
      // TODO revisit after updating assignment functionality for searchCases
      const cases = caseIds.map((caseId) => {
        return MockData.getSyncedCase({ override: { caseId } });
      });
      const findAssignmentsByAssignee = vi
        .spyOn(useCase.assignmentRepository, 'findAssignmentsByAssignee')
        .mockResolvedValue(assignments);
      const searchCases = vi
        .spyOn(useCase.casesRepository, 'searchCases')
        .mockResolvedValue({ metadata: { total: cases.length }, data: cases });

      const actual = await useCase.searchCases(applicationContext, { assignments: [user] }, false);

      expect(actual).toEqual({ metadata: { total: cases.length }, data: cases });
      expect(findAssignmentsByAssignee).toHaveBeenCalledWith(user.id);
      expect(searchCases).toHaveBeenCalledWith({
        assignments: [user],
        caseIds,
      });
    });

    test('should return empty array when no caseIds are found', async () => {
      const user = MockData.getCamsUser({ offices: [REGION_02_GROUP_NY, REGION_02_GROUP_BU] });
      const findAssignmentsByAssignee = vi
        .spyOn(useCase.assignmentRepository, 'findAssignmentsByAssignee')
        .mockResolvedValue([]);
      const searchCases = vi
        .spyOn(useCase.casesRepository, 'searchCases')
        .mockRejectedValue(new Error('this should not be called'));

      const actual = await useCase.searchCases(applicationContext, { assignments: [user] }, false);

      expect(actual).toEqual({ metadata: { total: 0 }, data: [] });
      expect(findAssignmentsByAssignee).toHaveBeenCalledWith(user.id);
      expect(searchCases).not.toHaveBeenCalled();
    });

    test('should throw UnknownError', async () => {
      const error = new Error('test error');
      vi.spyOn(useCase.casesRepository, 'searchCases').mockRejectedValue(error);
      await expect(useCase.searchCases(applicationContext, { caseNumber }, false)).rejects.toThrow(
        expect.objectContaining({
          message:
            'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
          status: 500,
          module: 'CASE-MANAGEMENT-USE-CASE',
          originalError: expect.stringContaining('Error: test error'),
        }),
      );
    });

    test('should pass through GatewayTimeoutError from repository', async () => {
      const { GatewayTimeoutError } = await import('../../common-errors/gateway-timeout');
      const error = new GatewayTimeoutError('CASES-MONGO-REPOSITORY', {
        message: 'Query failed. Search request timed out.',
      });
      vi.spyOn(useCase.casesRepository, 'searchCases').mockRejectedValue(error);
      await expect(useCase.searchCases(applicationContext, { caseNumber }, false)).rejects.toThrow(
        expect.objectContaining({
          message: 'Query failed. Search request timed out.',
          status: 504,
        }),
      );
    });

    test('should throw CamsError', async () => {
      const error = new CamsError('TEST', { message: 'test error' });
      vi.spyOn(useCase.casesRepository, 'searchCases').mockRejectedValue(error);
      await expect(useCase.searchCases(applicationContext, { caseNumber }, false)).rejects.toThrow(
        error,
      );
    });

    describe('search observability', () => {
      const mockTrace = {
        invocationId: 'mock-invocation',
        instanceId: 'local',
        startTime: Date.now(),
      };

      function getMockObservabilityGateway(): ObservabilityGateway {
        return {
          startTrace: vi.fn().mockReturnValue(mockTrace),
          completeTrace: vi.fn(),
        };
      }

      test('should call startTrace at entry', async () => {
        const mockGateway = getMockObservabilityGateway();
        applicationContext.observability = mockGateway;
        vi.spyOn(useCase.casesRepository, 'searchCases').mockResolvedValue({
          metadata: { total: 0 },
          data: [],
        });

        await useCase.searchCases(applicationContext, { caseNumber: '00-00000' }, false);

        expect(mockGateway.startTrace).toHaveBeenCalledWith(applicationContext.invocationId);
      });

      test('should call completeTrace with correct result on standard search success', async () => {
        const mockGateway = getMockObservabilityGateway();
        applicationContext.observability = mockGateway;
        const mockCases = [MockData.getSyncedCase({ override: { caseId: '001' } })];
        vi.spyOn(useCase.casesRepository, 'searchCases').mockResolvedValue({
          metadata: { total: 1 },
          data: mockCases,
        });

        await useCase.searchCases(
          applicationContext,
          { caseNumber: '00-00000', chapters: ['7'], excludeClosedCases: true },
          false,
        );

        expect(mockGateway.completeTrace).toHaveBeenCalledWith(
          mockTrace,
          'SearchComplete',
          expect.objectContaining({
            success: true,
            properties: expect.objectContaining({
              searchType: 'standard',
              caseNumberUsed: 'true',
              debtorNameUsed: 'false',
              chaptersUsed: 'true',
              divisionCodesUsed: 'false',
              excludeClosedCases: 'true',
            }),
            measurements: expect.objectContaining({
              resultCount: 1,
              totalCount: 1,
            }),
          }),
          expect.arrayContaining([
            expect.objectContaining({ name: 'SearchDuration' }),
            expect.objectContaining({ name: 'SearchResultCount', value: 1 }),
            expect.objectContaining({ name: 'SearchTotalCount', value: 1 }),
          ]),
        );
      });

      test('should call completeTrace with phonetic search type when phonetic is used', async () => {
        const mockCases = [MockData.getSyncedCase({ override: { caseId: '001' } })];
        const { useCase: uc } = await createCaseManagementTestContext({
          user,
          phoneticSearchEnabled: true,
        });
        const mockGateway = getMockObservabilityGateway();

        vi.spyOn(uc.casesRepository, 'searchCasesWithPhoneticTokens').mockResolvedValue({
          metadata: { total: 1 },
          data: mockCases,
        });

        const ctx = await createMockApplicationContext({ env: { STARTING_MONTH: '-6' } });
        ctx.featureFlags['phonetic-search-enabled'] = true;
        ctx.session = await createMockApplicationContextSession({ user });
        ctx.observability = mockGateway;

        await uc.searchCases(ctx, { debtorName: 'John Smith', chapters: ['15'] }, false);

        expect(mockGateway.completeTrace).toHaveBeenCalledWith(
          mockTrace,
          'SearchComplete',
          expect.objectContaining({
            success: true,
            properties: expect.objectContaining({
              searchType: 'phonetic',
              debtorNameUsed: 'true',
            }),
          }),
          expect.anything(),
        );
      });

      test('should call completeTrace with success false on error', async () => {
        const mockGateway = getMockObservabilityGateway();
        applicationContext.observability = mockGateway;
        const error = new Error('test error');
        vi.spyOn(useCase.casesRepository, 'searchCases').mockRejectedValue(error);

        await expect(
          useCase.searchCases(applicationContext, { caseNumber: '00-00000' }, false),
        ).rejects.toThrow();

        expect(mockGateway.completeTrace).toHaveBeenCalledWith(
          mockTrace,
          'SearchComplete',
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('test error'),
          }),
          expect.anything(),
        );
      });

      test('should call completeTrace on early return when no assignment caseIds found', async () => {
        const mockGateway = getMockObservabilityGateway();
        applicationContext.observability = mockGateway;
        const assignmentUser = MockData.getCamsUser({
          offices: [REGION_02_GROUP_NY, REGION_02_GROUP_BU],
        });
        vi.spyOn(useCase.assignmentRepository, 'findAssignmentsByAssignee').mockResolvedValue([]);

        await useCase.searchCases(applicationContext, { assignments: [assignmentUser] }, false);

        expect(mockGateway.completeTrace).toHaveBeenCalledWith(
          mockTrace,
          'SearchComplete',
          expect.objectContaining({
            success: true,
            measurements: expect.objectContaining({
              resultCount: 0,
              totalCount: 0,
            }),
          }),
          expect.anything(),
        );
      });

      test('should derive boolean flags correctly from predicate', async () => {
        const { useCase: uc } = await createCaseManagementTestContext({ user });
        const mockGateway = getMockObservabilityGateway();

        vi.spyOn(uc.casesRepository, 'searchCases').mockResolvedValue({
          metadata: { total: 0 },
          data: [],
        });

        const ctx = await createMockApplicationContext({ env: { STARTING_MONTH: '-6' } });
        ctx.session = await createMockApplicationContextSession({ user });
        ctx.observability = mockGateway;

        await uc.searchCases(
          ctx,
          {
            debtorName: 'Smith',
            chapters: ['7', '13'],
            excludeClosedCases: true,
          },
          false,
        );

        expect(mockGateway.completeTrace).toHaveBeenCalledWith(
          mockTrace,
          'SearchComplete',
          expect.objectContaining({
            properties: expect.objectContaining({
              debtorNameUsed: 'true',
              caseNumberUsed: 'false',
              divisionCodesUsed: 'false',
              chaptersUsed: 'true',
              excludeClosedCases: 'true',
            }),
          }),
          expect.anything(),
        );
      });
    });

    describe('phonetic filtering', () => {
      test('should apply hybrid search when enabled and debtorName is present', async () => {
        const mockCases = [
          MockData.getSyncedCase({
            override: { caseId: '001', debtor: { name: 'Michael Johnson' } },
          }),
          MockData.getSyncedCase({
            override: { caseId: '002', debtor: { name: 'Mike Johnson' } },
          }),
        ];

        const { context: contextWithPhonetic, useCase: useCaseWithPhonetic } =
          await createCaseManagementTestContext({
            user,
            phoneticSearchEnabled: true,
          });

        const hybridSearchSpy = vi
          .spyOn(useCaseWithPhonetic.casesRepository, 'searchCasesWithPhoneticTokens')
          .mockResolvedValue({
            metadata: { total: mockCases.length },
            data: mockCases,
          });

        const predicate: CasesSearchPredicate = {
          ...basePredicate,
          debtorName: 'Mike Johnson',
        };

        const result = await useCaseWithPhonetic.searchCases(contextWithPhonetic, predicate, false);

        expect(hybridSearchSpy).toHaveBeenCalledWith(predicate);
        expect(result.data.length).toBe(mockCases.length);
        expect(result.metadata.total).toBe(mockCases.length);
      });

      test('should NOT apply phonetic filtering when disabled', async () => {
        const mockCases = [
          MockData.getSyncedCase({
            override: { caseId: '001', debtor: { name: 'Michael Johnson' } },
          }),
          MockData.getSyncedCase({
            override: { caseId: '002', debtor: { name: 'Mike Johnson' } },
          }),
        ];

        const { context: contextWithoutPhonetic, useCase: useCaseWithoutPhonetic } =
          await createCaseManagementTestContext({
            user,
            phoneticSearchEnabled: false,
          });

        vi.spyOn(useCaseWithoutPhonetic.casesRepository, 'searchCases').mockResolvedValue({
          metadata: { total: mockCases.length },
          data: mockCases,
        });

        const predicate: CasesSearchPredicate = {
          ...basePredicate,
          debtorName: 'Mike Johnson',
        };

        const result = await useCaseWithoutPhonetic.searchCases(
          contextWithoutPhonetic,
          predicate,
          false,
        );

        expect(result.data.length).toBe(mockCases.length);
        expect(result.metadata.total).toBe(mockCases.length);
      });

      test('should NOT apply phonetic filtering when debtorName is not in predicate', async () => {
        const mockCases = [
          MockData.getSyncedCase({ override: { caseId: '001' } }),
          MockData.getSyncedCase({ override: { caseId: '002' } }),
        ];

        const { context: contextWithPhonetic, useCase: useCaseWithPhonetic } =
          await createCaseManagementTestContext({
            user,
            phoneticSearchEnabled: true,
          });

        vi.spyOn(useCaseWithPhonetic.casesRepository, 'searchCases').mockResolvedValue({
          metadata: { total: mockCases.length },
          data: mockCases,
        });

        const predicate: CasesSearchPredicate = {
          ...basePredicate,
          caseNumber: '00-00001',
        };

        const result = await useCaseWithPhonetic.searchCases(contextWithPhonetic, predicate, false);

        expect(result.data.length).toBe(mockCases.length);
        expect(result.metadata.total).toBe(mockCases.length);
      });

      test('should use hybrid search for phonetic variant matching', async () => {
        const mockCases = [
          MockData.getSyncedCase({
            override: { caseId: '001', debtor: { name: 'John Smith' } },
          }),
          MockData.getSyncedCase({
            override: { caseId: '002', debtor: { name: 'Jon Smith' } },
          }),
        ];

        const { context: contextWithPhonetic, useCase: useCaseWithPhonetic } =
          await createCaseManagementTestContext({
            user,
            phoneticSearchEnabled: true,
          });

        const hybridSearchSpy = vi
          .spyOn(useCaseWithPhonetic.casesRepository, 'searchCasesWithPhoneticTokens')
          .mockResolvedValue({
            metadata: { total: mockCases.length },
            data: mockCases,
          });

        const predicate: CasesSearchPredicate = {
          ...basePredicate,
          debtorName: 'John Smith',
        };

        const result = await useCaseWithPhonetic.searchCases(contextWithPhonetic, predicate, false);

        expect(hybridSearchSpy).toHaveBeenCalledWith(predicate);
        expect(result.metadata.total).toBe(mockCases.length);
      });

      test('should return database-scored results with correct metadata', async () => {
        const mockCases = [
          MockData.getSyncedCase({
            override: { caseId: '001', debtor: { name: 'Michael Johnson' } },
          }),
          MockData.getSyncedCase({
            override: { caseId: '002', debtor: { name: 'Mike Johnson' } },
          }),
        ];

        const { context: contextWithPhonetic, useCase: useCaseWithPhonetic } =
          await createCaseManagementTestContext({
            user,
            phoneticSearchEnabled: true,
          });

        vi.spyOn(
          useCaseWithPhonetic.casesRepository,
          'searchCasesWithPhoneticTokens',
        ).mockResolvedValue({
          metadata: { total: mockCases.length },
          data: mockCases,
        });

        const predicate: CasesSearchPredicate = {
          ...basePredicate,
          debtorName: 'Mike Johnson',
        };

        const result = await useCaseWithPhonetic.searchCases(contextWithPhonetic, predicate, false);

        expect(result.metadata.total).toBe(mockCases.length);
        expect(result.data.length).toBe(mockCases.length);
      });
    });
  });
});
