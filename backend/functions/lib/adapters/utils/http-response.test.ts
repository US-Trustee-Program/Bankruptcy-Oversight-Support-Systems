import { httpSuccess } from './http-response';

describe('Tests out http responses', () => {
  test('Should return properly formatted http success response', async () => {
    const expectedBody = { testObject: 'testValue' };
    const actualResult = httpSuccess({ body: expectedBody });

    expect(actualResult.statusCode).toEqual(200);
    expect(actualResult.body).toEqual(expectedBody);
    expect(actualResult.headers).toHaveProperty('Content-Type', 'application/json');
    expect(actualResult.headers).toHaveProperty('Last-Modified');
  });

  test('should return no content response', async () => {
    const actual = httpSuccess();
    expect(actual.statusCode).toEqual(204);
    expect(actual.body).toBeUndefined();
  });
});
