import { httpSuccess } from './http-response';

describe('Tests out http responses', () => {
  test('Should return properly formatted http success response', () => {
    const expectedBody = { testObject: 'testValue' };
    const actualResult = httpSuccess(expectedBody);

    expect(actualResult.statusCode).toEqual(200);
    expect(actualResult.body).toEqual(expectedBody);
    expect(actualResult.headers).toHaveProperty('Content-Type', 'application/json');
    expect(actualResult.headers).toHaveProperty('Last-Modified');
  });
});
