import CaseManagement, { getAction } from './case-management';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
import { UnknownError } from '../common-errors/unknown-error';
import { CamsError } from '../common-errors/cams-error';
import { describe } from 'node:test';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CaseDetail } from '../../../../common/src/cams/cases';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../testing/testing-utilities';
import { CamsRole } from '../../../../common/src/cams/roles';
import { getCasesGateway, getCasesRepository } from '../factory';

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
    role: CaseAssignmentRole.TrialAttorney,
    assignedOn: currentDate,
  },
  {
    documentType: 'ASSIGNMENT',
    id: '2',
    caseId: '081-23-01176',
    userId: attorneyJoeNobel.id,
    name: attorneyJoeNobel.name,
    role: CaseAssignmentRole.TrialAttorney,
    assignedOn: currentDate,
  },
];

const caseIdWithAssignments = '081-23-01176';
jest.mock('./case.assignment', () => {
  return {
    CaseAssignmentUseCase: jest.fn().mockImplementation(() => {
      return {
        findAssignmentsByCaseId: (caseId: string) => {
          if (caseId === 'ThrowError') {
            throw new Error('TestError');
          } else if (caseId === caseIdWithAssignments) {
            return Promise.resolve(assignments);
          } else {
            return Promise.resolve([]);
          }
        },
      };
    }),
  };
});

describe('Case management tests', () => {
  let applicationContext;
  let useCase;
  const userOffice = MockData.randomOffice();
  const user = {
    id: 'userId-Mock Name',
    name: 'Mock Name',
    offices: [userOffice],
    roles: [CamsRole.CaseAssignmentManager],
  };

  beforeAll(async () => {
    applicationContext = await createMockApplicationContext({
      STARTING_MONTH: '-6',
      DATABASE_MOCK: 'true',
    });
    applicationContext.session = await createMockApplicationContextSession({ user });
    useCase = new CaseManagement(applicationContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('contructor tests', () => {
    test('should always set casesRepo and officesGateway', () => {
      const casesGateway = getCasesGateway(applicationContext);
      const casesRepo = getCasesRepository(applicationContext);

      const basic = new CaseManagement(applicationContext);
      const withOptionalParams = new CaseManagement(applicationContext, casesGateway, casesRepo);

      expect(basic.casesGateway).toBeDefined();
      expect(basic.casesRepo).toBeDefined();
      expect(withOptionalParams.casesGateway).toBeDefined();
      expect(withOptionalParams.casesRepo).toBeDefined();
    });
  });

  describe('getAction tests', () => {
    test('should return post action if user has office with correct division code and Case Assignment Manager role', async () => {
      const officeDetail = applicationContext.session.user.offices[0];
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
        STARTING_MONTH: '-6',
        DATABASE_MOCK: 'true',
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
        STARTING_MONTH: '-6',
        DATABASE_MOCK: 'true',
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
      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      const caseDetail = MockData.getCaseDetail({
        override: {
          caseId: caseId,
          dateFiled,
          closedDate,
        },
      });

      const chapterCaseList = new CaseManagement(applicationContext);
      jest.spyOn(chapterCaseList.casesGateway, 'getCaseDetail').mockImplementation(async () => {
        return Promise.resolve(caseDetail);
      });

      const actualCaseDetail = await chapterCaseList.getCaseDetail(applicationContext, caseId);

      expect(actualCaseDetail.body.caseDetails.caseId).toEqual(caseId);
      expect(actualCaseDetail.body.caseDetails.dateFiled).toEqual(dateFiled);
      expect(actualCaseDetail.body.caseDetails.closedDate).toEqual(closedDate);
      expect(actualCaseDetail.body.caseDetails.assignments).toEqual(assignments);
    });

    test('should include case assignment action if the user has case assignment role', async () => {
      const officeName = 'Test Office';
      const officeDetail = applicationContext.session.user.offices[0];
      const caseNumber = '00-00000';
      const bCase = MockData.getCaseDetail({
        override: {
          ...officeDetail,
          caseId: '999-' + caseNumber,
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

      // TODO: This is gross. The response wrapper should be added by the controller, not the use case.
      // I Agree.  This is gross.
      const expected = {
        body: { caseDetails: { ...bCase, officeName, _actions } },
        message: '',
        success: true,
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
    test('should return summary with office name', async () => {
      const caseSummary = MockData.getCaseSummary({ override: { caseId: '000-00-00000' } });
      const officeName = 'OfficeName';

      const context = await createMockApplicationContext();
      jest.spyOn(useCase.casesGateway, 'getCaseSummary').mockResolvedValue(caseSummary);
      jest.spyOn(useCase.officesGateway, 'getOfficeName').mockReturnValue(officeName);

      const expected: CaseDetail = {
        ...caseSummary,
        officeName,
      };

      const actual = await useCase.getCaseSummary(context, '000-00-00000');
      expect(actual).toEqual(expected);
    });
  });

  describe('searchCases tests', () => {
    const caseNumber = '00-00000';

    test('should return an empty array for no matches', async () => {
      jest.spyOn(useCase.casesGateway, 'searchCases').mockResolvedValue([]);
      const actual = await useCase.searchCases(applicationContext, { caseNumber });
      expect(actual).toEqual([]);
    });

    test('should return a match', async () => {
      const caseList = [MockData.getCaseSummary({ override: { caseId: '999-' + caseNumber } })];
      jest.spyOn(useCase.casesGateway, 'searchCases').mockResolvedValue(caseList);
      const actual = await useCase.searchCases(applicationContext, { caseNumber });
      expect(actual).toEqual(caseList);
    });

    test('should return cases and actions for the user', async () => {
      const bCase = MockData.getCaseSummary({
        override: {
          caseId: '999-' + caseNumber,
          courtDivisionCode: applicationContext.session.user.offices[0].courtDivisionCode,
        },
      });
      const _actions = [
        {
          actionName: 'manage assignments',
          method: 'POST',
          path: `/case-assignments/${bCase.caseId}`,
        },
      ];

      const expected = [{ ...bCase, _actions }];
      jest.spyOn(useCase.casesGateway, 'searchCases').mockResolvedValue([bCase]);
      const actual = await useCase.searchCases(applicationContext, { caseNumber });
      expect(actual).toEqual(expected);
    });

    test('should throw UnknownError', async () => {
      const error = new Error('test error');
      const expectedError = new UnknownError('TEST', {
        message:
          'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
        originalError: error,
      });
      jest.spyOn(useCase.casesGateway, 'searchCases').mockRejectedValue(error);
      await expect(useCase.searchCases(applicationContext, { caseNumber })).rejects.toThrow(
        expectedError,
      );
    });

    test('should throw CamsError', async () => {
      const error = new CamsError('TEST', { message: 'test error' });
      jest.spyOn(useCase.casesGateway, 'searchCases').mockRejectedValue(error);
      await expect(useCase.searchCases(applicationContext, { caseNumber })).rejects.toThrow(error);
    });
  });
});
