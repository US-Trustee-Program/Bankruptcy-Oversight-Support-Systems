import CaseManagement, { getAction } from './case-management';
import { UnknownError } from '../common-errors/unknown-error';
import { CamsError } from '../common-errors/cams-error';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { CaseAssignment } from '../../../common/src/cams/assignments';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../testing/testing-utilities';
import { CamsRole } from '../../../common/src/cams/roles';
import { getCasesGateway } from '../factory';
import { ApplicationContext } from '../adapters/types/basic';
import { CamsUser } from '../../../common/src/cams/users';
import {
  REGION_02_GROUP_BU,
  REGION_02_GROUP_NY,
} from '../../../common/src/cams/test-utilities/mock-user';
import { ustpOfficeToCourtDivision } from '../../../common/src/cams/courts';
import { buildOfficeCode } from './offices/offices';
import { MockMongoRepository } from '../testing/mock-gateways/mock-mongo.repository';
import { TransferOrder } from '../../../common/src/cams/orders';
import { ConsolidationTo } from '../../../common/src/cams/events';

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

jest.mock('./case-assignment', () => {
  return {
    CaseAssignmentUseCase: jest.fn().mockImplementation(() => {
      return {
        findAssignmentsByCaseId: (caseIds: string[]) => {
          if (caseIds[0] === 'ThrowError') {
            throw new Error('TestError');
          } else if (caseIds[0] === caseIdWithAssignments) {
            return Promise.resolve(assignmentMap);
          } else {
            return Promise.resolve([]);
          }
        },
      };
    }),
  };
});

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
    jest.spyOn(MockMongoRepository.prototype, 'getTransfers').mockResolvedValue(mockTransfers);
    jest
      .spyOn(MockMongoRepository.prototype, 'getConsolidation')
      .mockResolvedValue(mockConsolidations);
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
    jest.restoreAllMocks();
  });

  describe('constructor tests', () => {
    test('should always set casesRepo and officesGateway', () => {
      const casesGateway = getCasesGateway(applicationContext);

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
      const applicationContext = await createMockApplicationContext({
        env: {
          STARTING_MONTH: '-6',
        },
      });
      applicationContext.session = await createMockApplicationContextSession({ user });

      const officeDetail = applicationContext.session.user.offices[0];
      const caseNumber = '00-00000';
      const bCase = MockData.getCaseDetail({
        override: {
          ...officeDetail,
          caseId: '999-' + caseNumber,
        },
      });

      const actual = getAction(applicationContext, bCase);
      expect(actual).toEqual([]);
    });

    test('should not return post action if the user does not have correct office assigned', async () => {
      const user = {
        id: 'userId-Mock Name',
        name: 'Mock Name',
        offices: [],
        roles: [CamsRole.CaseAssignmentManager],
      };
      const applicationContext = await createMockApplicationContext({
        env: {
          STARTING_MONTH: '-6',
        },
      });
      applicationContext.session = await createMockApplicationContextSession({ user });

      const officeDetail = applicationContext.session.user.offices[0];
      const caseNumber = '00-00000';
      const bCase = MockData.getCaseDetail({
        override: {
          ...officeDetail,
          caseId: '999-' + caseNumber,
        },
      });

      const actual = getAction(applicationContext, bCase);
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

      const chapterCaseList = new CaseManagement(applicationContext);
      jest.spyOn(chapterCaseList.casesGateway, 'getCaseDetail').mockImplementation(async () => {
        return Promise.resolve(caseDetail);
      });

      jest.spyOn(chapterCaseList.casesGateway, 'getCaseDetail').mockResolvedValue(caseDetail);

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

      jest.spyOn(useCase.officesGateway, 'getOfficeName').mockReturnValue(officeName);
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

      jest.spyOn(useCase.casesGateway, 'getCaseDetail').mockResolvedValue(bCase);
      const actual = await useCase.getCaseDetail(applicationContext, bCase.caseId);
      expect(actual).toEqual(expected);
    });

    test('should throw an AssignmentError when CaseAssignmentUseCase.findAssignmentsByCaseId throws an error', async () => {
      const bCase = MockData.getCaseDetail({ override: { caseId: 'ThrowError' } });

      await expect(useCase.getCaseDetail(applicationContext, bCase.caseId)).rejects.toThrow(
        'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
      );
    });
  });

  describe('Case summary tests', () => {
    test('should return summary', async () => {
      const caseSummary = MockData.getCaseSummary({ override: { caseId: '000-00-00000' } });

      const context = await createMockApplicationContext();
      jest.spyOn(useCase.casesGateway, 'getCaseSummary').mockResolvedValue(caseSummary);

      const actual = await useCase.getCaseSummary(context, '000-00-00000');
      expect(actual).toEqual(caseSummary);
    });
  });

  describe('searchCases tests', () => {
    const caseNumber = '00-00000';

    test('should return an empty array for no matches', async () => {
      jest.spyOn(useCase.casesGateway, 'searchCases').mockResolvedValue([]);
      const actual = await useCase.searchCases(applicationContext, { caseNumber }, false);
      expect(actual).toEqual([]);
    });

    const optionsCases = [
      { caseName: 'NOT get case assignments', includeCaseAssignments: false },
      { caseName: 'GET case assignments', includeCaseAssignments: true },
    ];
    test.each(optionsCases)(`should return a match and $caseName`, async (args) => {
      const caseList = [MockData.getCaseSummary({ override: { caseId: '999-' + caseNumber } })];
      jest.spyOn(useCase.casesGateway, 'searchCases').mockResolvedValue(caseList);
      const assignmentsSpy = jest
        .spyOn(MockMongoRepository.prototype, 'findAssignmentsByCaseId')
        .mockImplementation(() => {
          if (args.includeCaseAssignments) {
            return Promise.resolve(
              new Map([
                [
                  caseList[0].caseId,
                  [MockData.getAttorneyAssignment({ caseId: caseList[0].caseId })],
                ],
              ]),
            );
          } else {
            return Promise.reject('We should not have retrieved assignments.');
          }
        });
      const actual = await useCase.searchCases(
        applicationContext,
        { caseNumber },
        args.includeCaseAssignments,
      );
      expect(actual).toEqual(caseList);
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

      const expected = [{ ...bCase, officeCode, _actions }];
      jest.spyOn(useCase.casesGateway, 'searchCases').mockResolvedValue([bCase]);
      const actual = await useCase.searchCases(applicationContext, { caseNumber }, false);
      expect(actual).toEqual(expected);
    });

    test('should return search cases by assignment', async () => {
      const user = MockData.getCamsUser({ offices: [REGION_02_GROUP_NY, REGION_02_GROUP_BU] });
      const caseIds = ['081-00-12345', '081-11-23456', '091-12-34567'];
      const assignments = caseIds.map((caseId) => MockData.getAttorneyAssignment({ caseId }));
      const cases = caseIds.map((caseId) => {
        return MockData.getCaseSummary({ override: { caseId } });
      });
      const findAssignmentsByAssignee = jest
        .spyOn(useCase.assignmentGateway, 'findAssignmentsByAssignee')
        .mockResolvedValue(assignments);
      const searchCases = jest.spyOn(useCase.casesGateway, 'searchCases').mockResolvedValue(cases);

      const actual = await useCase.searchCases(applicationContext, { assignments: [user] }, false);

      expect(actual).toEqual(cases);
      expect(findAssignmentsByAssignee).toHaveBeenCalledWith(user.id);
      expect(searchCases).toHaveBeenCalledWith(expect.any(Object), {
        assignments: [user],
        caseIds,
      });
    });

    test('should throw UnknownError', async () => {
      const error = new Error('test error');
      const expectedError = new UnknownError('TEST', {
        message:
          'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
        originalError: error,
      });
      jest.spyOn(useCase.casesGateway, 'searchCases').mockRejectedValue(error);
      await expect(useCase.searchCases(applicationContext, { caseNumber }, false)).rejects.toThrow(
        expectedError,
      );
    });

    test('should throw CamsError', async () => {
      const error = new CamsError('TEST', { message: 'test error' });
      jest.spyOn(useCase.casesGateway, 'searchCases').mockRejectedValue(error);
      await expect(useCase.searchCases(applicationContext, { caseNumber }, false)).rejects.toThrow(
        error,
      );
    });
  });
});
