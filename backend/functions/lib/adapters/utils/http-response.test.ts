import { CamsHttpResponseInit, httpSuccess } from './http-response';

type TestType = {
  testString: string;
};

describe('Tests out http responses', () => {
  test('Should return properly formatted http success response', async () => {
    const data = {
      testString: 'testValue',
    };
    const input: CamsHttpResponseInit<TestType> = {
      body: {
        data,
      },
    };
    const actualResult = httpSuccess(input);

    expect(actualResult.statusCode).toEqual(200);
    expect(actualResult.body).toEqual({ data });
    expect(actualResult.headers).toHaveProperty('Content-Type', 'application/json');
    expect(actualResult.headers).toHaveProperty('Last-Modified');
  });

  test('should return no content response', async () => {
    const actual = httpSuccess();
    expect(actual.statusCode).toEqual(204);
    expect(actual.body).toBeUndefined();
  });
});
