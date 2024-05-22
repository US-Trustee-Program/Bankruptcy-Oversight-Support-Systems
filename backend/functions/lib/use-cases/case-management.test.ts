import { CaseListDbResult } from '../adapters/types/cases';
import { CaseManagement } from './case-management';
import { CasesInterface } from './cases.interface';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import { GatewayHelper } from '../adapters/gateways/gateway-helper';
import { getYearMonthDayStringFromDate } from '../adapters/utils/date-helper';
import { MockCasesGateway } from '../adapters/gateways/case-management.mock.gateway';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
import { UnknownError } from '../common-errors/unknown-error';
import { CamsError } from '../common-errors/cams-error';
import { describe } from 'node:test';
import { CASE_SUMMARIES } from '../testing/mock-data/case-summaries.mock';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CaseDetail } from '../../../../common/src/cams/cases';
import { CaseAssignment } from '../../../../common/src/cams/assignments';

const functionContext = require('azure-function-context-mock');

const attorneyJaneSmith = 'Jane Smith';
const attorneyJoeNobel = 'Joe Nobel';
const currentDate = new Date().toISOString();
const assignments: CaseAssignment[] = [
  {
    documentType: 'ASSIGNMENT',
    id: '1',
    caseId: '081-23-01176',
    name: attorneyJaneSmith,
    role: CaseAssignmentRole.TrialAttorney,
    assignedOn: currentDate,
  },
  {
    documentType: 'ASSIGNMENT',
    id: '2',
    caseId: '081-23-01176',
    name: attorneyJoeNobel,
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

  beforeAll(async () => {
    process.env = {
      STARTING_MONTH: '-6',
      DATABASE_MOCK: 'true',
    };
    applicationContext = await applicationContextCreator(functionContext);
    useCase = new CaseManagement(applicationContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Case list tests', () => {
    test('Calling getCases should return valid data', async () => {
      const chapterCaseList = new CaseManagement(applicationContext);
      const caseList: CaseDetail[] = [MockData.getCaseDetail(), MockData.getCaseDetail()];
      const mockChapterList: CaseListDbResult = {
        success: true,
        message: '',
        count: 2,
        body: {
          caseList,
        },
      };

      jest.spyOn(chapterCaseList.casesGateway, 'getCases').mockImplementation(async () => {
        return caseList;
      });

      const results = await chapterCaseList.getCases(applicationContext);

      expect(results).toStrictEqual(mockChapterList);
    });

    test('Calling getCases without a starting month filter should return valid data for the last 6 months of default', async () => {
      const today = new Date();
      const expectedStartDate = getYearMonthDayStringFromDate(
        new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()),
      );

      const mockCasesGateway: CasesInterface = new MockCasesGateway();
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );
      const actual = await chapterCaseList.getCases(applicationContext);
      function checkDate(aCase) {
        const verify = aCase.dateFiled >= expectedStartDate;
        return verify;
      }

      expect(actual.body.caseList.every(checkDate)).toBe(true);
      expect(actual.body.caseList.length).toEqual(3);
    });

    test('should return results with expected assignments', async () => {
      const mockCasesGateway: CasesInterface = new MockCasesGateway();
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );
      const cases = await chapterCaseList.getCases(applicationContext);
      const caseWithAssignments = cases.body.caseList.filter((theCase) => {
        return theCase.caseId === caseIdWithAssignments;
      })[0];
      expect(caseWithAssignments).toEqual(
        expect.objectContaining({
          caseId: caseIdWithAssignments,
          assignments: expect.arrayContaining([attorneyJaneSmith, attorneyJoeNobel]),
        }),
      );
      const casesWithoutAssignments = cases.body.caseList.filter((theCase) => {
        return theCase.caseId !== caseIdWithAssignments;
      });
      let count = 0;
      casesWithoutAssignments.forEach((bCase) => {
        expect(bCase).toEqual(
          expect.objectContaining({
            assignments: [],
          }),
        );
        count++;
      });
      expect(count).toEqual(2);
    });

    test('should throw error and return specific error message received when error is thrown in casesGateway.getCases', async () => {
      class MockCasesGatewayWithError extends MockCasesGateway {
        async getCases(
          _context,
          _options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
        ): Promise<CaseDetail[]> {
          throw Error('some random error');
        }
      }
      const mockCasesGateway: CasesInterface = new MockCasesGatewayWithError();
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );
      try {
        await chapterCaseList.getCases(applicationContext);
        expect(1).toBe(0);
      } catch (e) {
        expect(e.message).toEqual(
          'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
        );
        expect(e).toBeInstanceOf(UnknownError);
      }
    });

    test('should throw error with given message and return it when thrown in casesGateway.getCases', async () => {
      class MockCasesGatewayWithError extends MockCasesGateway {
        async getCases(
          _context,
          _options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
        ): Promise<CaseDetail[]> {
          throw new CamsError('SOME_MODULE', { message: 'some error message' });
        }
      }
      const mockCasesGateway: CasesInterface = new MockCasesGatewayWithError();
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );
      try {
        await chapterCaseList.getCases(applicationContext);
        expect(1).toBe(0);
      } catch (e) {
        expect(e.message).toEqual('some error message');
        expect(e).not.toBeInstanceOf(UnknownError);
      }
    });

    test('should throw error if assignee names lookup throws an error', async () => {
      const caseThatWillThrowError: CaseDetail = {
        ...CASE_SUMMARIES[0],
        caseId: 'ThrowError',
      };
      jest
        .spyOn(MockCasesGateway.prototype, 'getCases')
        .mockResolvedValue([caseThatWillThrowError]);

      const mockCasesGateway: CasesInterface = new MockCasesGateway();
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );
      await expect(chapterCaseList.getCases(applicationContext)).rejects.toThrow();
    });

    test('should call getCases with undefined if STARTING_MONTH exists as a string that is not a number', async () => {
      const mockCasesGateway: CasesInterface = new MockCasesGateway();
      const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );

      process.env = {
        ...process.env,
        STARTING_MONTH: 'not a number',
      };
      await chapterCaseList.getCases(applicationContext);

      expect(casesGatewaySpy).toHaveBeenCalledWith(applicationContext, {
        startingMonth: undefined,
      });
    });

    test('should call getCases with the same starting number if STARTING_MONTH is negative', async () => {
      const mockCasesGateway: CasesInterface = new MockCasesGateway();
      const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );

      process.env = {
        ...process.env,
        STARTING_MONTH: '-70',
      };
      await chapterCaseList.getCases(applicationContext);

      expect(casesGatewaySpy).toHaveBeenCalledWith(applicationContext, { startingMonth: -70 });
    });

    test('should negate STARTING_MONTH if getCases is called with a positive number', async () => {
      const mockCasesGateway: CasesInterface = new MockCasesGateway();
      const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );

      process.env = {
        ...process.env,
        STARTING_MONTH: '70',
      };
      await chapterCaseList.getCases(applicationContext);

      expect(casesGatewaySpy).toHaveBeenCalledWith(applicationContext, { startingMonth: -70 });
    });

    test('should call getCases with undefined if STARTING_MONTH is undefined', async () => {
      const mockCasesGateway: CasesInterface = new MockCasesGateway();
      const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );

      process.env = {
        ...process.env,
        STARTING_MONTH: undefined,
      };
      await chapterCaseList.getCases(applicationContext);

      expect(casesGatewaySpy).toHaveBeenCalledWith(applicationContext, {
        startingMonth: undefined,
      });
    });

    test('should call getCases with undefined if STARTING_MONTH is null', async () => {
      const mockCasesGateway: CasesInterface = new MockCasesGateway();
      const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
      const chapterCaseList: CaseManagement = new CaseManagement(
        applicationContext,
        mockCasesGateway,
      );

      process.env = {
        ...process.env,
        STARTING_MONTH: null,
      };
      await chapterCaseList.getCases(applicationContext);

      expect(casesGatewaySpy).toHaveBeenCalledWith(applicationContext, {
        startingMonth: undefined,
      });
    });
  });

  describe('Case detail tests', () => {
    test('Should return a properly formatted case when a case number is supplied', async () => {
      const applicationContext = await applicationContextCreator(functionContext);
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
  });

  describe('Case summary tests', () => {
    test('should return summary with office name', async () => {
      const caseSummary = MockData.getCaseSummary({ override: { caseId: '000-00-00000' } });
      const officeName = 'OfficeName';

      const context = await applicationContextCreator(functionContext);
      jest.spyOn(useCase.casesGateway, 'getCaseSummary').mockResolvedValue(caseSummary);
      jest.spyOn(useCase.officesGateway, 'getOffice').mockReturnValue(officeName);

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
      const actual = await useCase.searchCases({ caseNumber });
      expect(actual).toEqual([]);
    });

    test('should return a match', async () => {
      const caseList = [MockData.getCaseSummary({ override: { caseId: '999-' + caseNumber } })];
      jest.spyOn(useCase.casesGateway, 'searchCases').mockResolvedValue(caseList);
      const actual = await useCase.searchCases({ caseNumber });
      expect(actual).toEqual(caseList);
    });

    test('should throw UnknownError', async () => {
      const error = new Error('test error');
      const expectedError = new UnknownError('TEST', {
        message:
          'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
        originalError: error,
      });
      jest.spyOn(useCase.casesGateway, 'searchCases').mockRejectedValue(error);
      await expect(useCase.searchCases({ caseNumber })).rejects.toThrow(expectedError);
    });

    test('should throw CamsError', async () => {
      const error = new CamsError('TEST', { message: 'test error' });
      jest.spyOn(useCase.casesGateway, 'searchCases').mockRejectedValue(error);
      await expect(useCase.searchCases({ caseNumber })).rejects.toThrow(error);
    });
  });
});
