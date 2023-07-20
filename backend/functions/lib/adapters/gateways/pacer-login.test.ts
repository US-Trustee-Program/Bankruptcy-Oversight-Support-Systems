import { PacerLogin } from './pacer-login';
import { MockPacerTokenSecretGateway } from './mock-pacer-token-secret.gateway';
import { applicationContextCreator } from '../utils/application-context-creator';
const http = require('../utils/http');
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);

describe('PACER login tests', () => {
  test('should throw error when pacer login fails', async () => {
    const pacerLogin = new PacerLogin(new MockPacerTokenSecretGateway(false));
    const responseValue = {
      status: 200,
      data: { errorDescription: 'Login Failed', loginResult: 1 },
    };
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return responseValue;
    });

    await expect(pacerLogin.getPacerToken(appContext)).rejects.toEqual(Error('Login Failed'));
  });

  test('should throw error when pacer returns a result > 1', async () => {
    const pacerLogin = new PacerLogin(new MockPacerTokenSecretGateway(false));
    const responseValue = {
      status: 200,
      data: { errorDescription: 'Some random error', loginResult: 2 },
    };
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return responseValue;
    });

    await expect(pacerLogin.getPacerToken(appContext)).rejects.toEqual(
      Error('Error retrieving token'),
    );
  });

  test('should throw error when pacer returns a status that is not 200', async () => {
    const pacerLogin = new PacerLogin(new MockPacerTokenSecretGateway(false));
    const responseValue = {
      status: 400,
      data: {},
    };
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return responseValue;
    });

    await expect(pacerLogin.getPacerToken(appContext)).rejects.toEqual(
      Error('Failed to Connect to PACER API'),
    );
  });

  test('should throw error when httpPost throws an error', async () => {
    const pacerLogin = new PacerLogin(new MockPacerTokenSecretGateway(false));
    const message = 'something went really wrong';
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      throw Error(message);
    });

    await expect(pacerLogin.getPacerToken(appContext)).rejects.toEqual(Error(message));
  });

  test('should return token when valid response is received from Pacer', async () => {
    const pacerLogin = new PacerLogin(new MockPacerTokenSecretGateway(true));
    const expectedValue = 'abcdefghijklmnopqrstuvwxyz1234567890';
    const responseValue = {
      status: 200,
      data: { nextGenCSO: expectedValue, loginResult: 0 },
    };
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return responseValue;
    });

    expect(await pacerLogin.getPacerToken(appContext)).toEqual(expectedValue);
  });

  test('should return token when saving new token to Azure KeyVault', async () => {
    const pacerLogin = new PacerLogin(new MockPacerTokenSecretGateway(true));
    const expectedValue = 'abcdefghijklmnopqrstuvwxyz1234567890';
    const responseValue = {
      status: 200,
      data: { nextGenCSO: expectedValue, loginResult: 0 },
    };
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return responseValue;
    });
    expect(await pacerLogin.getAndStorePacerToken(appContext)).toEqual(expectedValue);
  });

  test('getAndStorePacerToken method should throw an error when the response in non 200 ', async () => {
    const pacerLogin = new PacerLogin(new MockPacerTokenSecretGateway(true));
    const responseValue = {
      status: 404,
    };
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return responseValue;
    });

    try {
      await pacerLogin.getAndStorePacerToken(appContext);
    } catch (e) {
      expect(e).toEqual(new Error('Failed to Connect to PACER API'));
    }
  });
});
