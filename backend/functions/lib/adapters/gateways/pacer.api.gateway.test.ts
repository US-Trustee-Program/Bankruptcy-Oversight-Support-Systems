import { PacerApiGateway } from './pacer.api.gateway';
import { Chapter15Case } from '../types/cases';
import { GatewayHelper } from './gateway-helper';
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
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        data: 'Unauthorized user',
        status: 401,
      };
    });

    const gateway = new PacerApiGateway();
    const response = await gateway.getChapter15Cases();
    console.log(response);
    await expect(gateway.getChapter15Cases()).rejects.toThrow('Unexpected response from Pacer API');
  });

  xtest('should return content for 200 response for case-locator', async () => {
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
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        data: {
          content: mockedApiResponse,
        },
        status: 200,
      };
    });

    const gateway = new PacerApiGateway();

    expect(await gateway.getChapter15Cases()).toEqual(expectedResponseValue);
  });

  /*
   * I don't understand this test.  What are we trying to do here??
   */
  test('should call httpPost with the correct url and token header for case-locator', async () => {
    const postSpy = jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        data: {},
        status: 200,
      };
    });
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://fake-subdomain.uscourts.gov/pcl-public-api/rest/cases',
        headers: { 'X-NEXT-GEN-CSO': 'fake-token' },
      }),
    );
  });
  /**/
});
