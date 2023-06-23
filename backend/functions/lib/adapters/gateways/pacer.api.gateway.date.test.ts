import { PacerApiGateway } from './pacer.api.gateway';
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

describe('PACER API gateway tests relating specifically to date ranges', () => {
  const gatewayHelper = new GatewayHelper();

  test('should set the starting month to -6 if a starting month is not passed into getChapter15Cases', async () => {
    gatewayHelper.pacerMockExtract().slice(0, 2);
    const expectedStartingMonth = -6;
    const date = new Date();
    date.setMonth(date.getMonth() + expectedStartingMonth);
    const expectedDate = date.toISOString().split('T')[0];

    const httpPostSpy = jest.spyOn(http, 'httpPost').mockImplementation(() => {
      console.log('=== Im in the mock');
      return {
        data: {
          content: [],
        },
        status: 200,
      };
    });

    const gateway = new PacerApiGateway();
    gateway.getChapter15Cases();

    //expect(httpPostSpy).toHaveBeenCalled();
    /*
    expect(httpPostSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          dateFiledFrom: expectedDate,
        }),
      }),
    );
    */
  });

  xtest('should set the starting month to value passed into getChapter15Cases', async () => {
    gatewayHelper.pacerMockExtract().slice(0, 2);
    const expectedStartingMonth = -25;
    const date = new Date();
    date.setMonth(date.getMonth() + expectedStartingMonth);
    const expectedDate = date.toISOString().split('T')[0];
    const gateway = new PacerApiGateway();

    const getCasesListFromPacerApiSpy = jest.spyOn(gateway, 'getCasesListFromPacerApi');

    gateway.getChapter15Cases(expectedStartingMonth);

    expect(getCasesListFromPacerApiSpy).toHaveBeenCalled();
    /*
    expect(getCasesListFromPacerApiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          dateFiledFrom: expectedDate,
        }),
      }),
    );
    */
  });
});
