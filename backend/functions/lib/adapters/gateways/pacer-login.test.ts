import PacerLogin from './pacer-login';
const http = require('../utils/http');

describe('PACER API gateway tests', () => {
  test('should reject when pacer login fails', async () => {
    const pacerLogin = new PacerLogin();
    const responseValue = {
      status: 200,
      data: { errorDescription: 'Login Failed', loginResult: 1 },
    };
    jest.spyOn(http, 'httpPost').mockImplementation(() => {
      return responseValue;
    });

    expect(pacerLogin.getPacerToken()).rejects.toEqual(Error('Login Failed'));
  });
});
