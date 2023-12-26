import { CaseListDbResult, CaseDetailInterface } from '../adapters/types/cases';
import { CaseManagement } from './case-management';
import { CasesInterface } from './cases.interface';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import { GatewayHelper } from '../adapters/gateways/gateway-helper';
import { getYearMonthDayStringFromDate } from '../adapters/utils/date-helper';
import { MockCasesGateway } from '../adapters/gateways/case-management.mock.gateway';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
import { UnknownError } from '../common-errors/unknown-error';
import { CamsError } from '../common-errors/cams-error';
import { CaseAssignment } from '../adapters/types/case.assignment';

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
          if (caseId === caseIdWithAssignments) {
            return Promise.resolve(assignments);
          } else {
            return Promise.resolve([]);
          }
        },
      };
    }),
  };
});

describe('Case list tests', () => {
  let applicationContext;
  beforeEach(async () => {
    applicationContext = await applicationContextCreator(functionContext);
    process.env = {
      STARTING_MONTH: '-6',
      DATABASE_MOCK: 'true',
    };
  });

  test('Calling getCases should return valid data', async () => {
    const chapterCaseList = new CaseManagement(applicationContext);
    const caseList: CaseDetailInterface[] = [
      {
        caseId: '001-04-44449',
        caseTitle: 'Flo Esterly and Neas Van Sampson',
        dateFiled: '2005-05-04',
        assignments: [],
        chapter: '15',
        courtDivision: '081',
        officeName: 'New York',
      },
      {
        caseId: '001-06-1122',
        caseTitle: 'Jennifer Millhouse',
        dateFiled: '2006-03-27',
        assignments: [],
        chapter: '15',
        courtDivision: '081',
        officeName: 'New York',
      },
    ];
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
      ): Promise<CaseDetailInterface[]> {
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
      ): Promise<CaseDetailInterface[]> {
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

    expect(casesGatewaySpy).toHaveBeenCalledWith(applicationContext, { startingMonth: undefined });
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

    expect(casesGatewaySpy).toHaveBeenCalledWith(applicationContext, { startingMonth: undefined });
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

    expect(casesGatewaySpy).toHaveBeenCalledWith(applicationContext, { startingMonth: undefined });
  });
});

describe('Case detail tests', () => {
  test('Should return a properly formatted case when a case number is supplied', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const caseId = caseIdWithAssignments;
    const dateFiled = '2018-11-16';
    const closedDate = '2019-06-21';
    const assignments = [attorneyJaneSmith, attorneyJoeNobel];
    const caseDetail = {
      caseId: caseId,
      caseTitle: 'Daniels LLC',
      dateFiled,
      closedDate,
      assignments: [],
      dxtrId: '12345',
      courtId: '0208',
      chapter: '15',
      courtDivision: '081',
    };

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
