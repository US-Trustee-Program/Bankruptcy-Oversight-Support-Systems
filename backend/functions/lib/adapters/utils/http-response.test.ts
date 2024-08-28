import { CamsError } from '../../common-errors/cams-error';
import { INTERNAL_SERVER_ERROR } from '../../common-errors/constants';
import { httpError, httpSuccess } from './http-response';

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

  test('Should return properly formatted http error response', () => {
    const moduleName = 'TEST-MODULE';
    const camsError = new CamsError(moduleName, { message: 'Foo', status: INTERNAL_SERVER_ERROR });
    const expectedBody = { message: camsError.message, success: false };
    const actualResult = httpError(camsError);

    expect(actualResult.statusCode).toEqual(camsError.status);
    expect(actualResult.body).toEqual(expectedBody);
    expect(actualResult.headers).toHaveProperty('Content-Type', 'application/json');
    expect(actualResult.headers).toHaveProperty('Last-Modified');
  });
});
