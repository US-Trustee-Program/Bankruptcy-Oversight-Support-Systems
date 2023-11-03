import { CaseListDbResult, CaseDetailInterface } from '../adapters/types/cases';
import { CaseManagement } from './case-management';
import { CasesInterface } from './cases.interface';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import { GatewayHelper } from '../adapters/gateways/gateway-helper';
import { getYearMonthDayStringFromDate } from '../adapters/utils/date-helper';
import { MockCasesGateway } from '../adapters/gateways/mock-cases.gateway';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';

const functionContext = require('azure-function-context-mock');

const attorneyJaneSmith = 'Jane Smith';
const attorneyJoeNobel = 'Joe Nobel';
const assignments: CaseAttorneyAssignment[] = [
  {
    id: '1',
    caseId: '081-23-01176',
    name: attorneyJaneSmith,
    role: CaseAssignmentRole.TrialAttorney,
  },
  {
    id: '2',
    caseId: '081-23-01176',
    name: attorneyJoeNobel,
    role: CaseAssignmentRole.TrialAttorney,
  },
];

const caseIdWithAssignments = '081-23-01176';
jest.mock('./case.assignment', () => {
  return {
    CaseAssignment: jest.fn().mockImplementation(() => {
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
  let appContext;
  beforeEach(async () => {
    appContext = await applicationContextCreator(functionContext);
    process.env = {
      STARTING_MONTH: '-6',
      DATABASE_MOCK: 'true',
    };
  });

  test('Calling getCases should return valid data', async () => {
    const chapterCaseList = new CaseManagement();
    const caseList: CaseDetailInterface[] = [
      {
        caseId: '001-04-44449',
        caseTitle: 'Flo Esterly and Neas Van Sampson',
        dateFiled: '2005-05-04',
        assignments: [],
        chapter: '15',
      },
      {
        caseId: '001-06-1122',
        caseTitle: 'Jennifer Millhouse',
        dateFiled: '2006-03-27',
        assignments: [],
        chapter: '15',
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

    const results = await chapterCaseList.getCases(appContext);

    expect(results).toStrictEqual(mockChapterList);
  });

  test('Calling getCases without a starting month filter should return valid data for the last 6 months of default', async () => {
    const today = new Date();
    const expectedStartDate = getYearMonthDayStringFromDate(
      new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()),
    );

    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const chapterCaseList: CaseManagement = new CaseManagement(mockCasesGateway);
    const actual = await chapterCaseList.getCases(appContext);
    function checkDate(aCase) {
      const verify = aCase.dateFiled >= expectedStartDate;
      return verify;
    }

    expect(actual.body.caseList.every(checkDate)).toBe(true);
    expect(actual.body.caseList.length).toEqual(3);
  });

  test('should return results with expected assignments', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const chapterCaseList: CaseManagement = new CaseManagement(mockCasesGateway);
    const cases = await chapterCaseList.getCases(appContext);
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        context,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
      ): Promise<CaseDetailInterface[]> {
        throw Error('some random error');
      }
    }
    const mockCasesGateway: CasesInterface = new MockCasesGatewayWithError();
    const chapterCaseList: CaseManagement = new CaseManagement(mockCasesGateway);
    expect(await chapterCaseList.getCases(appContext)).toEqual({
      body: { caseList: [] },
      count: 0,
      message: 'some random error',
      success: false,
    });
  });

  test('should throw error with default message and return Unknown Error received when unknown error is thrown in casesGateway.getCases', async () => {
    class MockCasesGatewayWithError extends MockCasesGateway {
      async getCases(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        context,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
      ): Promise<CaseDetailInterface[]> {
        throw Error('');
      }
    }
    const mockCasesGateway: CasesInterface = new MockCasesGatewayWithError();
    const chapterCaseList: CaseManagement = new CaseManagement(mockCasesGateway);
    expect(await chapterCaseList.getCases(appContext)).toEqual({
      body: { caseList: [] },
      count: 0,
      message: 'Unknown Error received while retrieving cases',
      success: false,
    });
  });

  test('should call getCases with undefined if STARTING_MONTH exists as a string that is not a number', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
    const chapterCaseList: CaseManagement = new CaseManagement(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: 'not a number',
    };
    await chapterCaseList.getCases(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: undefined });
  });

  test('should call getCases with the same starting number if STARTING_MONTH is negative', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
    const chapterCaseList: CaseManagement = new CaseManagement(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: '-70',
    };
    await chapterCaseList.getCases(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: -70 });
  });

  test('should negate STARTING_MONTH if getCases is called with a positive number', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
    const chapterCaseList: CaseManagement = new CaseManagement(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: '70',
    };
    await chapterCaseList.getCases(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: -70 });
  });

  test('should call getCases with undefined if STARTING_MONTH is undefined', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
    const chapterCaseList: CaseManagement = new CaseManagement(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: undefined,
    };
    await chapterCaseList.getCases(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: undefined });
  });

  test('should call getCases with undefined if STARTING_MONTH is null', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getCases');
    const chapterCaseList: CaseManagement = new CaseManagement(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: null,
    };
    await chapterCaseList.getCases(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: undefined });
  });
});

describe('Case detail tests', () => {
  test('Should return a properly formatted case when a case number is supplied', async () => {
    const appContext = await applicationContextCreator(functionContext);
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
    };

    const chapterCaseList = new CaseManagement();
    jest.spyOn(chapterCaseList.casesGateway, 'getCaseDetail').mockImplementation(async () => {
      return Promise.resolve(caseDetail);
    });

    const actualCaseDetail = await chapterCaseList.getCaseDetail(appContext, caseId);

    expect(actualCaseDetail.body.caseDetails.caseId).toEqual(caseId);
    expect(actualCaseDetail.body.caseDetails.dateFiled).toEqual(dateFiled);
    expect(actualCaseDetail.body.caseDetails.closedDate).toEqual(closedDate);
    expect(actualCaseDetail.body.caseDetails.assignments).toEqual(assignments);
  });
});
