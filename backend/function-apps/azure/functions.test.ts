import { HttpRequest, HttpResponseInit } from '@azure/functions';

import { CamsHttpRequest } from '../../lib/adapters/types/http';
import { CamsHttpResponseInit } from '../../lib/adapters/utils/http-response';
import { azureToCamsHttpRequest, toAzureSuccess } from './functions';

describe('function-apps test', () => {
  test('should return properly formatted CamsHttpRequest from malformed headers and query', async () => {
    const request = {
      method: 'GET',
      params: { arg1: 'hello' },
      query: 'bar',
      url: '/test',
    } as unknown as HttpRequest;

    const expected: CamsHttpRequest = {
      body: undefined,
      headers: {},
      method: 'GET',
      params: { arg1: 'hello' },
      query: {},
      url: '/test',
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
      body: { data: { prop1: true } },
      headers: { foo: 'bar' },
      statusCode: 200,
    };
    const expected: HttpResponseInit = {
      headers: { foo: 'bar' },
      jsonBody: { data: { prop1: true } },
      status: 200,
    };
    const responseInit = toAzureSuccess(camsResponseInit);
    expect(responseInit).toEqual(expected);
  });
});
