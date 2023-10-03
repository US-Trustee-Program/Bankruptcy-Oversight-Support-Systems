import { CaseListDbResult, Chapter15CaseInterface } from '../adapters/types/cases';
import Chapter15CaseList from './chapter-15.case';
import { CasesInterface } from './cases.interface';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import { GatewayHelper } from '../adapters/gateways/gateway-helper';
import { getYearMonthDayStringFromDate } from '../adapters/utils/date-helper';
import { MockCasesGateway } from '../adapters/gateways/mock-cases.gateway';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';

const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);

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

describe('Chapter 15 case list tests', () => {
  beforeEach(() => {
    process.env = {
      STARTING_MONTH: '-6',
      DATABASE_MOCK: 'true',
    };
  });

  test('Calling getChapter15CaseList should return valid chapter 15 data', async () => {
    const chapter15CaseList = new Chapter15CaseList();
    const caseList: Chapter15CaseInterface[] = [
      {
        caseId: '001-04-44449',
        caseTitle: 'Flo Esterly and Neas Van Sampson',
        dateFiled: '2005-05-04',
        assignments: [],
      },
      {
        caseId: '001-06-1122',
        caseTitle: 'Jennifer Millhouse',
        dateFiled: '2006-03-27',
        assignments: [],
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

    jest.spyOn(chapter15CaseList.casesGateway, 'getChapter15Cases').mockImplementation(async () => {
      return caseList;
    });

    const results = await chapter15CaseList.getChapter15CaseList(appContext);

    expect(results).toStrictEqual(mockChapterList);
  });

  test('Calling getChapter15CaseList without a starting month filter should return valid chapter 15 data for the last 6 months of default', async () => {
    const today = new Date();
    const expectedStartDate = getYearMonthDayStringFromDate(
      new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()),
    );

    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockCasesGateway);
    const actual = await chapter15CaseList.getChapter15CaseList(appContext);
    function checkDate(aCase) {
      const verify = aCase.dateFiled >= expectedStartDate;
      return verify;
    }

    expect(actual.body.caseList.every(checkDate)).toBe(true);
    expect(actual.body.caseList.length).toEqual(3);
  });

  test('should return results with expected assignments', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockCasesGateway);
    const cases = await chapter15CaseList.getChapter15CaseList(appContext);
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

  test('should throw error and return specific error message received when error is thrown in casesGateway.getChapter15Cases', async () => {
    class MockCasesGatewayWithError extends MockCasesGateway {
      async getChapter15Cases(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        context,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
      ): Promise<Chapter15CaseInterface[]> {
        throw Error('some random error');
      }
    }
    const mockCasesGateway: CasesInterface = new MockCasesGatewayWithError();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockCasesGateway);
    expect(await chapter15CaseList.getChapter15CaseList(appContext)).toEqual({
      body: { caseList: [] },
      count: 0,
      message: 'some random error',
      success: false,
    });
  });

  test('should throw error with default message and return Unknown Error received when unknown error is thrown in casesGateway.getChapter15Cases', async () => {
    class MockCasesGatewayWithError extends MockCasesGateway {
      async getChapter15Cases(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        context,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
      ): Promise<Chapter15CaseInterface[]> {
        throw Error('');
      }
    }
    const mockCasesGateway: CasesInterface = new MockCasesGatewayWithError();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockCasesGateway);
    expect(await chapter15CaseList.getChapter15CaseList(appContext)).toEqual({
      body: { caseList: [] },
      count: 0,
      message: 'Unknown Error received while retrieving cases',
      success: false,
    });
  });

  test('should call getChapter15Cases with undefined if STARTING_MONTH exists as a string that is not a number', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: 'not a number',
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: undefined });
  });

  test('should call getChapter15Cases with the same starting number if STARTING_MONTH is negative', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: '-70',
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: -70 });
  });

  test('should negate STARTING_MONTH if getChapter15Cases is called with a positive number', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: '70',
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: -70 });
  });

  test('should call getChapter15Cases with undefined if STARTING_MONTH is undefined', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: undefined,
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: undefined });
  });

  test('should call getChapter15Cases with undefined if STARTING_MONTH is null', async () => {
    const mockCasesGateway: CasesInterface = new MockCasesGateway();
    const casesGatewaySpy = jest.spyOn(mockCasesGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockCasesGateway);

    process.env = {
      ...process.env,
      STARTING_MONTH: null,
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(casesGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: undefined });
  });
});

describe('Chapter 15 case detail tests', () => {
  test('Should return a properly formatted case when a case number is supplied', async () => {
    const chapter15CaseList = new Chapter15CaseList();
    jest.spyOn(chapter15CaseList.casesGateway, 'getChapter15Case');
    const caseId = '081-18-00235';
    const caseDetail = {
      caseId: caseId,
      caseTitle: 'Daniels LLC',
      dateFiled: '2018-11-16',
      dateClosed: '2019-06-21',
      assignments: [attorneyJaneSmith, attorneyJoeNobel],
    };
    const expectedCaseDetail = {
      success: true,
      message: '',
      body: {
        caseDetail,
      },
    };
    // invoke method under test
    const actualCaseDetail = await chapter15CaseList.getChapter15CaseDetail(appContext, caseId);
    expect(actualCaseDetail).toEqual(expectedCaseDetail);
    // context and caseId
  }, 10000);
});
