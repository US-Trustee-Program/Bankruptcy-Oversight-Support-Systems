import { ObjectKeyVal } from '../type-declarations/basic';
import Api from './api';
import * as httpAdapter from '../components/utils/http.adapter';
import { vi } from 'vitest';

describe('Specific tests for the API model', () => {
  test('createPath should return a properly constructed URL when passed a basic path and an array of query parameters', () => {
    const path = '/foo/bar';
    const params: ObjectKeyVal = {
      first_name: 'John',
      last_name: 'Smith',
    };

    const result = Api.createPath(path, params);

    expect(result).toEqual('/foo/bar?first_name=John&last_name=Smith');
  });

  test('call to Post which throws any server error should reject with a 500', async () => {
    const mockHttpPost = vi.fn().mockResolvedValue(new Error('bad request'));
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    await expect(Api.post('/some/path', {})).rejects.toThrow(
      '500 Error - Server Error response.json is not a function',
    );

    // Verify that the mock function was called
    expect(mockHttpPost).toHaveBeenCalled();
  });

  // TODO CAMS-87 UI test blocking build
  test('should return error message when response is not ok', () => {
    const mockHttpPost = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ error: 'mock post' }),
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    expect(Api.post('/some/path', {})).rejects.toThrow('mock post');
  });

  // TODO CAMS-87 UI test blocking build
  test('should return data when response is Ok', () => {
    const mockHttpPost = vi.fn().mockImplementation(() => ({
      json: () => 'mock post',
      ok: true,
    }));
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    expect(Api.post('/some/path', {})).resolves.toBe('mock post');
  });

  test('call to Get with a server error should reject with a 500', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => {
      throw Error('bad request');
    });
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.list('/some/path', {})).rejects.toThrow('500 Error - Server Error bad request');
  });

  test('call to Get with invalid parameters should return with a 404', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => 'mock get',
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.list('/some/path', {})).rejects.toThrow(
      '404 Error - Not Found mock get - Response was not OK',
    );
  });

  test('call to Get with valid parameters should return with an OK', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => 'mock get',
      ok: true,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.list('/some/path', {})).resolves.toBe('mock get');
  });
});
