import { PacerGatewayInterface } from './pacer.gateway.interface';

const context = require('azure-function-context-mock');
import { CaseListDbResult, Chapter15Case } from '../adapters/types/cases';
import Chapter15CaseList from './chapter-15-case-list';
import { MockPacerApiGateway } from '../adapters/gateways/mock-pacer.api.gateway';

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
      count: 0,
      body: {
        caseList,
      },
    };

    jest.spyOn(chapter15CaseList.pacerGateway, 'getChapter15Cases').mockImplementation(async () => {
      return caseList;
    });

    const results = await chapter15CaseList.getChapter15CaseList(context);

    expect(results).toStrictEqual(mockChapterList);
  });

  test('Calling getChapter15CaseList without a starting month filter should return valid chapter 15 data for the last 6 months of default', async () => {
    let today = new Date();
    const expectedStartDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())
      .toISOString()
      .split('T')[0];

    const mockPacerGateway: PacerGatewayInterface = new MockPacerApiGateway();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);
    const actual = await chapter15CaseList.getChapter15CaseList(context);
    function checkDate(aCase) {
      const verify = aCase.dateFiled >= expectedStartDate;
      return verify;
    }

    expect(actual.body.caseList.every(checkDate)).toBe(true);
    expect(actual.body.caseList.length == 3);

  });

  test('should throw error and return specific error message received from PACER server when error is thrown in pacerGateway.getChapter15Cases', async () => {
    class MockPacerApiGatewayWithError extends MockPacerApiGateway {
      async getChapter15Cases(startingMonth?: number): Promise<Chapter15Case[]> {
        throw Error('some random error');
      }
    }
    const mockPacerGateway: PacerGatewayInterface = new MockPacerApiGatewayWithError();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);
    expect(await chapter15CaseList.getChapter15CaseList(context)).toEqual({
      body: { caseList: [] },
      count: 0,
      message: 'some random error',
      success: false,
    });
  });

  test('should throw error with default message and return Unknown Error received from PACER server when unknown error is thrown in pacerGateway.getChapter15Cases', async () => {
    class MockPacerApiGatewayWithError extends MockPacerApiGateway {
      async getChapter15Cases(startingMonth?: number): Promise<Chapter15Case[]> {
        throw Error('');
      }
    }
    const mockPacerGateway: PacerGatewayInterface = new MockPacerApiGatewayWithError();
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);
    expect(await chapter15CaseList.getChapter15CaseList(context)).toEqual({
      body: { caseList: [] },
      count: 0,
      message: 'Unknown Error received from PACER server',
      success: false,
    });
  });

  test('should call getChapter15Cases with undefined if STARTING_MONTH exists as a string that is not a number', async () => {
    const mockPacerGateway: PacerGatewayInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: 'not a number',
    };
    await chapter15CaseList.getChapter15CaseList(context);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(undefined);
  });

  test('should call getChapter15Cases with -70 if STARTING_MONTH is "-70"', async () => {
    const mockPacerGateway: PacerGatewayInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: '-70',
    };
    await chapter15CaseList.getChapter15CaseList(context);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(-70);
  });

  test('should call getChapter15Cases with -70 if STARTING_MONTH is "70"', async () => {
    const mockPacerGateway: PacerGatewayInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: '70',
    };
    await chapter15CaseList.getChapter15CaseList(context);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(-70);
  });

  test('should call getChapter15Cases with undefined if STARTING_MONTH is undefined', async () => {
    const mockPacerGateway: PacerGatewayInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: undefined,
    };
    await chapter15CaseList.getChapter15CaseList(context);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(undefined);
  });

  test('should call getChapter15Cases with undefined if STARTING_MONTH is null', async () => {
    const mockPacerGateway: PacerGatewayInterface = new MockPacerApiGateway();
    const pacerGatewaySpy = jest.spyOn(mockPacerGateway, 'getChapter15Cases');
    const chapter15CaseList: Chapter15CaseList = new Chapter15CaseList(mockPacerGateway);

    process.env = {
      STARTING_MONTH: null,
    };
    await chapter15CaseList.getChapter15CaseList(context);

    expect(pacerGatewaySpy).toHaveBeenCalledWith(undefined);
  });
});
