import { azureToCamsHttpRequest, toAzureSuccess } from './functions';
import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { CamsHttpRequest } from '../../lib/adapters/types/http';
import { CamsHttpResponseInit } from '../../lib/adapters/utils/http-response';

describe('functions test', () => {
  test('should return properly formatted CamsHttpRequest from malformed headers and query', async () => {
    const request = {
      method: 'GET',
      url: '/test',
      query: 'bar',
      params: { arg1: 'hello' },
    } as unknown as HttpRequest;

    const expected: CamsHttpRequest = {
      method: 'GET',
      url: '/test',
      headers: {},
      query: {},
      params: { arg1: 'hello' },
      body: undefined,
    };

    const response = await azureToCamsHttpRequest(request);
    expect(response).toEqual(expected);
  });

  test('should return empty Azure response init', () => {
    const responseInit = toAzureSuccess();
    expect(responseInit).toEqual({});
  });

  test('should return Azure response init', () => {
    const camsResponseInit: CamsHttpResponseInit<{ prop1: boolean }> = {
      headers: { foo: 'bar' },
      statusCode: 200,
      body: { data: { prop1: true } },
    };
    const expected: HttpResponseInit = {
      headers: { foo: 'bar' },
      status: 200,
      jsonBody: { data: { prop1: true } },
    };
    const responseInit = toAzureSuccess(camsResponseInit);
    expect(responseInit).toEqual(expected);
  });
});
