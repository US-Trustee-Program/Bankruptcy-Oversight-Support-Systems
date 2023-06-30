import { PacerApiGateway } from './pacer.api.gateway';
import { Chapter15Case } from '../types/cases';
import { GatewayHelper } from './gateway-helper';
import { HttpResponse } from '../types/http';
const http = require('../utils/http');

jest.mock('./pacer-login', () => {
  return {
    PacerLogin: jest.fn().mockImplementation(() => {
      return {
        getPacerToken: jest.fn().mockReturnValue('abcdefghijklmnopqrstuvwxyz0123456789'),
        getAndStorePacerToken: jest.fn().mockReturnValue('abcdefghijklmnopqrstuvwxyz0123456789'),
      };
    }),
  };
});

describe('PACER API gateway tests', () => {
  const gatewayHelper = new GatewayHelper();

  beforeAll(() => {
    process.env = {
      PACER_CASE_LOCATOR_URL: 'https://fake-subdomain.uscourts.gov',
    };
  });

  test('should return error message for non-200 response for case-locator', async () => {
    const httpPostSpy = jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        data: 'Unauthorized user',
        status: 401,
      };
    });

    const gateway = new PacerApiGateway(-6);

    await expect(gateway.getChapter15Cases()).rejects.toThrow('Unexpected response from Pacer API');
    expect(httpPostSpy).toHaveBeenCalled();
  });

  test('should return content for 200 response for case-locator', async () => {
    const mockedApiResponse = gatewayHelper.pacerMockExtract().slice(0, 2);
    const expectedResponseValue: Chapter15Case[] = [
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
    const httpPostSpy = jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        data: {
          content: mockedApiResponse,
        },
        status: 200,
      };
    });

    const gateway = new PacerApiGateway(-6);

    expect(await gateway.getChapter15Cases()).toEqual(expectedResponseValue);
    expect(httpPostSpy).toHaveBeenCalled();
  });

  test('should set the starting month to -6 if a starting month is not passed into getChapter15Cases', async () => {
    gatewayHelper.pacerMockExtract().slice(0, 2);
    const expectedStartingMonth = -6;
    const date = new Date();
    date.setMonth(date.getMonth() + expectedStartingMonth);
    const expectedDate = date.toISOString().split('T')[0];

    const httpPostSpy = jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        data: {
          content: [],
        },
        status: 200,
      };
    });

    const gateway = new PacerApiGateway(-6);
    await gateway.getChapter15Cases();

    expect(httpPostSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          dateFiledFrom: expectedDate,
        }),
      }),
    );
  });

  test('should set the starting month to value passed into getChapter15Cases', async () => {
    gatewayHelper.pacerMockExtract().slice(0, 2);
    const expectedStartingMonth = -25;
    const date = new Date();
    date.setMonth(date.getMonth() + expectedStartingMonth);
    const expectedDate = date.toISOString().split('T')[0];
    const gateway = new PacerApiGateway(-6);

    const getCasesListFromPacerApiSpy = jest.spyOn(gateway, 'getCasesListFromPacerApi');
    const httpPostSpy = jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        data: {
          content: [],
        },
        status: 200,
      };
    });

    await gateway.getChapter15Cases(expectedStartingMonth);

    expect(getCasesListFromPacerApiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFiledFrom: expectedDate,
      }),
    );
  });

});
