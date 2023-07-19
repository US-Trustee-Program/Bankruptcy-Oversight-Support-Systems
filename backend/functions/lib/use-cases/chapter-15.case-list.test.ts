import { CaseListDbResult, Chapter15Case } from '../adapters/types/cases';
import Chapter15CaseList from './chapter-15.case-list';
import { MockPacerApiGateway } from '../adapters/gateways/mock-pacer.api.gateway';
import { CasesInterface } from './cases.interface';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import { GatewayHelper } from '../adapters/gateways/gateway-helper';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);

jest.mock('../adapters/gateways/pacer-login', () => {
  return {
    PacerLogin: jest.fn().mockImplementation(() => {
      return {
        getPacerToken: jest.fn().mockReturnValue('abcdefghijklmnopqrstuvwxyz0123456789'),
        getAndStorePacerToken: jest.fn().mockReturnValue('abcdefghijklmnopqrstuvwxyz0123456789'),
      };
    }),
  };
});

describe('Chapter 15 case tests', () => {
  beforeEach(() => {
    process.env = {
      STARTING_MONTH: '-6',
      DATABASE_MOCK: 'true',
    };
  });

  test('Calling getChapter15CaseList should return valid chapter 15 data', async () => {
    const chapter15CaseList = new Chapter15CaseList();
    const caseList: Chapter15Case[] = [
      {
        caseNumber: '04-44449',
        caseTitle: 'Flo Esterly and Neas Van Sampson',
        dateFiled: '2005-05-04',
      },
      {
        caseNumber: '06-1122',
        caseTitle: 'Jennifer Millhouse',
        dateFiled: '2006-03-27',
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

    jest.spyOn(chapter15CaseList.pacerGateway, 'getChapter15Cases').mockImplementation(async () => {
      return caseList;
    });

    const results = await chapter15CaseList.getChapter15CaseList(appContext);

    expect(results).toStrictEqual(mockChapterList);
  });

  test('Calling getChapter15CaseList without a starting month filter should return valid chapter 15 data for the last 6 months of default', async () => {
    const today = new Date();
    const expectedStartDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())
      .toISOString()
      .split('T')[0];

    const mockPacerGateway: CasesInterface = new MockPacerApiGateway();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);
    const actual = await chapter15CaseList.getChapter15CaseList(appContext);
    function checkDate(aCase) {
      const verify = aCase.dateFiled >= expectedStartDate;
      return verify;
    }

    expect(actual.body.caseList.every(checkDate)).toBe(true);
    expect(actual.body.caseList.length == 3);
  });

  test('should throw error and return specific error message received from PACER server when error is thrown in pacerGateway.getChapter15Cases', async () => {
    class MockPacerApiGatewayWithError extends MockPacerApiGateway {
      async getChapter15Cases(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        context,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
      ): Promise<Chapter15Case[]> {
        throw Error('some random error');
      }
    }
    const mockPacerGateway: CasesInterface = new MockPacerApiGatewayWithError();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);
    expect(await chapter15CaseList.getChapter15CaseList(appContext)).toEqual({
      body: { caseList: [] },
      count: 0,
      message: 'some random error',
      success: false,
    });
  });

  test('should throw error with default message and return Unknown Error received from PACER server when unknown error is thrown in pacerGateway.getChapter15Cases', async () => {
    class MockPacerApiGatewayWithError extends MockPacerApiGateway {
      async getChapter15Cases(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        context,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: { startingMonth?: number; gatewayHelper?: GatewayHelper },
      ): Promise<Chapter15Case[]> {
        throw Error('');
      }
    }
    const mockPacerGateway: CasesInterface = new MockPacerApiGatewayWithError();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);
    expect(await chapter15CaseList.getChapter15CaseList(appContext)).toEqual({
      body: { caseList: [] },
      count: 0,
      message: 'Unknown Error received from PACER server',
      success: false,
    });
  });

  test('should call getChapter15Cases with undefined if STARTING_MONTH exists as a string that is not a number', async () => {
    const mockPacerGateway: CasesInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: 'not a number',
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: undefined });
  });

  test('should call getChapter15Cases with the same starting number if STARTING_MONTH is negative', async () => {
    const mockPacerGateway: CasesInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: '-70',
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: -70 });
  });

  test('should negate STARTING_MONTH if getChapter15Cases is called with a positive number', async () => {
    const mockPacerGateway: CasesInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: '70',
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: -70 });
  });

  test('should call getChapter15Cases with undefined if STARTING_MONTH is undefined', async () => {
    const mockPacerGateway: CasesInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: undefined,
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: undefined });
  });

  test('should call getChapter15Cases with undefined if STARTING_MONTH is null', async () => {
    const mockPacerGateway: CasesInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: null,
    };
    await chapter15CaseList.getChapter15CaseList(appContext);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(appContext, { startingMonth: undefined });
  });
});
