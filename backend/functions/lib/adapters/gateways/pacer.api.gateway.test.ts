import { PacerApiGateway } from './pacer.api.gateway';
import { Chapter15Case } from '../types/cases';
import { GatewayHelper } from './gateway-helper';

const http = require('../utils/http');

describe('PACER API gateway tests', () => {
  const gatewayHelper = new GatewayHelper();

  beforeAll(() => {
    process.env = {
      PACER_TOKEN: 'fake-token',
      PACER_CASE_LOCATOR_URL: 'https://fake-subdomain.uscourts.gov'
    }
  })

  test('should return error message for non-200 response', async () => {
    const responseValue = { status: 401, message: 'Unauthorized user' };
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        json: () => ({ content: responseValue }),
        status: 401,
      };
    });

    const gateway = new PacerApiGateway();
    await expect(gateway.getChapter15Cases()).rejects.toEqual({ content: responseValue });
  });

  test('should return content for 200 response', async () => {
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
      }
    ];
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        json: () => ({ content: mockedApiResponse }),
        status: 200,
      };
    });

    const gateway = new PacerApiGateway();

    expect(await gateway.getChapter15Cases()).toEqual(expectedResponseValue);
  });

  test('should call httpPost with the correct url and token header', async () => {
    const postSpy = jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return {
        json: () => ({}),
        status: 200,
      };
    });

    expect(postSpy).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://fake-subdomain.uscourts.gov/pcl-public-api/rest/cases',
      headers: { 'X-NEXT-GEN-CSO': 'fake-token' },
    }));
  });
});
