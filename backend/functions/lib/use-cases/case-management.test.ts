import { CaseManagement } from './case-management';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
import { UnknownError } from '../common-errors/unknown-error';
import { CamsError } from '../common-errors/cams-error';
import { describe } from 'node:test';
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
