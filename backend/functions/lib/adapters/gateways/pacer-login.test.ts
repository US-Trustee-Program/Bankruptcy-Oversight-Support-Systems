import { PacerLogin } from './pacer-login';
import { MockPacerTokenSecretGateway } from './mock-pacer-token-secret.gateway';
const http = require('../utils/http');

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

    await expect(pacerLogin.getPacerToken()).rejects.toEqual(Error('Login Failed'));
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

    await expect(pacerLogin.getPacerToken()).rejects.toEqual(Error('Error retrieving token'));
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

    await expect(pacerLogin.getPacerToken()).rejects.toEqual(Error('Failed to Connect to PACER API'));
  });

  test('should throw error when httpPost throws an error', async () => {
    const pacerLogin = new PacerLogin(new MockPacerTokenSecretGateway(false));
    const message = 'something went really wrong';
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      throw Error(message);
    });

    await expect(pacerLogin.getPacerToken()).rejects.toEqual(Error(message));
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

    expect(await pacerLogin.getPacerToken()).toEqual(expectedValue);
  });

  // test getAndStorePacerToken
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
    jest.spyOn(pacerT)
  });
});
